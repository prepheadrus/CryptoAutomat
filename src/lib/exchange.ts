import ccxt from 'ccxt';

// Bu, sunucu tarafında çalışan bir modüldür. Client bileşenlerinde içe aktarmayın.

/**
 * Desteklenen tüm borsaların bir listesini döndürür.
 * @returns Borsa kimliklerinin bir dizisi.
 */
export async function getSupportedExchanges() {
    return ccxt.exchanges;
}

/**
 * Belirtilen bir borsa ve sembol için güncel ticker bilgisini (fiyat dahil) getirir.
 * @param exchangeId Borsa kimliği (örn: 'binance').
 * @param symbol Ticaret çifti (örn: 'BTC/USDT').
 * @returns Ticker nesnesi.
 */
export async function getTicker(exchangeId: string, symbol: string) {
    if (!ccxt.exchanges.includes(exchangeId)) {
        throw new Error(`'${exchangeId}' borsası desteklenmiyor.`);
    }

    try {
        const exchangeClass = (ccxt as any)[exchangeId];
        const exchange = new exchangeClass();
        const ticker = await exchange.fetchTicker(symbol);
        return ticker;
    } catch (error) {
        console.error(`${symbol} için ${exchangeId} borsasından ticker alınırken hata:`, error);
        throw new Error(`Ticker verisi alınamadı. Detaylar için sunucu kayıtlarına bakın.`);
    }
}

/**
 * Belirtilen bir borsa ve sembol için güncel fiyatı getirir.
 * @param exchangeId Borsa kimliği (örn: 'binance').
 * @param symbol Ticaret çifti (örn: 'BTC/USDT').
 * @returns Sembolün son fiyatı.
 */
export async function fetchPrice(exchangeId: string, symbol: string): Promise<number> {
    const ticker = await getTicker(exchangeId, symbol);
    if (!ticker || typeof ticker.last !== 'number') {
        throw new Error(`${symbol} için ${exchangeId} borsasından geçerli bir fiyat alınamadı.`);
    }
    return ticker.last;
}


/**
 * Belirtilen bir borsa ve sembol için mum (OHLCV) verilerini getirir.
 * @param exchangeId Borsa kimliği (örn: 'binance').
 * @param symbol Ticaret çifti (örn: 'BTC/USDT').
 * @param timeframe Zaman aralığı (örn: '1h', '4h', '1d').
 * @param limit Getirilecek mum sayısı.
 * @returns Mum verilerinin bir dizisi.
 */
export async function fetchOHLCV(exchangeId: string, symbol: string, timeframe: string = '1h', limit: number = 100): Promise<ccxt.OHLCV[]> {
     if (!ccxt.exchanges.includes(exchangeId)) {
        throw new Error(`'${exchangeId}' borsası desteklenmiyor.`);
    }

    try {
        const exchangeClass = (ccxt as any)[exchangeId];
        const exchange = new exchangeClass();

        if (!exchange.has['fetchOHLCV']) {
            throw new Error(`'${exchangeId}' borsası fetchOHLCV metodunu desteklemiyor.`);
        }

        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        return ohlcv;
    } catch (error) {
        console.error(`${symbol} için ${exchangeId} borsasından OHLCV alınırken hata:`, error);
        throw new Error(`OHLCV verisi alınamadı. Detaylar için sunucu kayıtlarına bakın.`);
    }
}