// Bu dosya, `src/lib/compiler.ts`'den gelen Strategy nesnesini işler.
import { fetchOHLCV, fetchPrice } from './exchange';
import { calculateRSI } from './indicators';
import type { Node, Edge } from '@xyflow/react';

// Compiler'dan gelen strateji yapısı
type Strategy = {
  indicator: {
    type: string;
    period: number;
  };
  condition: {
    operator: string;
    value: number;
  };
  action: {
    type: string;
    amount: number;
  };
};

type EngineResult = {
    decision: 'BUY' | 'SELL' | 'WAIT';
    message: string;
    data: any;
}

/**
 * Verilen bir stratejiyi gerçek zamanlı verilerle çalıştırır ve bir ticaret kararı döndürür.
 * Bu bir simülasyondur. Gerçek emirler gönderilmez.
 * @param strategy Strateji editöründen derlenmiş strateji nesnesi.
 * @param symbol Üzerinde işlem yapılacak ticaret çifti (örn: 'BTC/USDT').
 * @returns Bir karar, açıklama mesajı ve ilgili verileri içeren bir nesne.
 */
export async function runStrategy(strategy: Strategy, symbol: string = 'BTC/USDT'): Promise<EngineResult> {
    try {
        // 1. Veriyi Çek
        // İndikatör için gerekli olan mum verilerini (OHLCV) çekiyoruz.
        // RSI için sadece kapanış fiyatları yeterlidir.
        const ohlcv = await fetchOHLCV('binance', symbol, '1h');
        if (!ohlcv || ohlcv.length === 0) {
            throw new Error('Borsadan mum verisi alınamadı.');
        }
        const closingPrices = ohlcv.map(candle => candle[4]); // 4. index kapanış fiyatıdır.

        // 2. İndikatörü Hesapla
        let indicatorValue: number;
        if (strategy.indicator.type.toLowerCase() === 'rsi') {
            const rsiResult = calculateRSI(closingPrices, strategy.indicator.period);
            if (rsiResult.length === 0) {
                throw new Error('RSI hesaplanamadı. Yeterli veri olmayabilir.');
            }
            indicatorValue = rsiResult[rsiResult.length - 1]; // En son RSI değerini al
        } else {
            // Diğer indikatörler (SMA, EMA vb.) burada eklenebilir.
            throw new Error(`Desteklenmeyen indikatör tipi: ${strategy.indicator.type}`);
        }

        // 3. Koşulu Değerlendir
        const { operator, value: thresholdValue } = strategy.condition;
        let conditionMet = false;

        switch (operator) {
            case 'gt': // Büyüktür
                conditionMet = indicatorValue > thresholdValue;
                break;
            case 'lt': // Küçüktür
                conditionMet = indicatorValue < thresholdValue;
                break;
            case 'crossover':
                 // Crossover mantığı daha karmaşık olduğu için bu örnekte basitleştirilmiştir.
                 // Genellikle iki farklı indikatörün kesişimini içerir.
                 throw new Error('Kesişim (crossover) operatörü henüz desteklenmiyor.');
            default:
                throw new Error(`Geçersiz operatör: ${operator}`);
        }

        // 4. Karar Ver
        if (conditionMet) {
            const decision = strategy.action.type.toUpperCase() as 'BUY' | 'SELL';
            const currentPrice = await fetchPrice('binance', symbol);
            return {
                decision: decision,
                message: `Karar: ${decision}. Koşul sağlandı (${indicatorValue.toFixed(2)} ${operator} ${thresholdValue}). Fiyat: ${currentPrice}`,
                data: { indicatorValue, thresholdValue, currentPrice }
            };
        } else {
            return {
                decision: 'WAIT',
                message: `Karar: BEKLE. Koşul sağlanmadı (${indicatorValue.toFixed(2)} ${operator} ${thresholdValue} değil).`,
                data: { indicatorValue, thresholdValue }
            };
        }

    } catch (error) {
        console.error('Bot motorunda hata:', error);
        return {
            decision: 'WAIT',
            message: `Hata: Bot çalıştırılamadı. ${(error as Error).message}`,
            data: { error: (error as Error).message }
        };
    }
}
