
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

const symbolToName: Record<string, string> = {
    'BTC': 'Bitcoin', 'ETH': 'Ethereum', 'SOL': 'Solana', 'BNB': 'Binance Coin',
    'AVAX': 'Avalanche', 'DOT': 'Polkadot', 'MATIC': 'Polygon', 'LINK': 'Chainlink',
    'XRP': 'Ripple', 'ADA': 'Cardano', 'DOGE': 'Dogecoin', 'SHIB': 'Shiba Inu',
    'LTC': 'Litecoin', 'BCH': 'Bitcoin Cash', 'TRX': 'Tron', 'ATOM': 'Cosmos',
    'NEAR': 'Near Protocol', 'UNI': 'Uniswap', 'FTM': 'Fantom', 'ICP': 'Internet Computer',
};

// In-memory cache
let cachedMarkets: string[] = [];
let marketsLastFetchTime: number = 0;
const MARKETS_CACHE_DURATION = 3600000; // 1 hour

let cachedTickers: any = null;
let tickersLastFetchTime: number = 0;
const TICKERS_CACHE_DURATION = 5000; // 5 seconds

async function getMarkets(exchange: ccxt.Exchange) {
    const now = Date.now();
    if (cachedMarkets.length > 0 && (now - marketsLastFetchTime < MARKETS_CACHE_DURATION)) {
        return cachedMarkets;
    }
    
    console.log("Piyasa listesi önbelleği eski, yeniden alınıyor...");
    await exchange.loadMarkets();
    const usdtMarkets = exchange.symbols.filter(s => s.endsWith('/USDT') && !s.includes(':') && !s.includes('/'));
    
    cachedMarkets = usdtMarkets;
    marketsLastFetchTime = now;
    
    return cachedMarkets;
}


export async function GET() {
    const now = Date.now();
    
    // Serve from tickers cache if data is fresh
    if (cachedTickers && (now - tickersLastFetchTime < TICKERS_CACHE_DURATION)) {
        return NextResponse.json(cachedTickers);
    }

    try {
        const exchange = new ccxt.binance();
        const allUsdtSymbols = await getMarkets(exchange);
        
        // Fetch tickers in chunks to avoid hitting API rate limits
        const chunkSize = 100;
        const allTickers: { [key: string]: ccxt.Ticker } = {};

        for (let i = 0; i < allUsdtSymbols.length; i += chunkSize) {
            const chunk = allUsdtSymbols.slice(i, i + chunkSize);
            try {
                const tickersChunk = await exchange.fetchTickers(chunk);
                Object.assign(allTickers, tickersChunk);
            } catch (e) {
                 // If a chunk fails, log it but continue with the next one
                console.warn(`Piyasa verisi alınırken bir bölüm başarısız oldu: ${chunk.join(',')}`, e);
            }
        }

        const formattedTickers = Object.values(allTickers)
            .filter(ticker => ticker.last && ticker.percentage !== undefined)
            .map(ticker => {
                const baseCurrency = ticker.symbol.split('/')[0];
                return {
                    symbol: baseCurrency,
                    name: symbolToName[baseCurrency] || baseCurrency, // Fallback to symbol if name not in map
                    price: ticker.last,
                    change: ticker.percentage
                };
            })
            // Sort by symbol alphabetically
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
        
        const response = { tickers: formattedTickers };
        
        // Update tickers cache
        cachedTickers = response;
        tickersLastFetchTime = now;

        return NextResponse.json(response);

    } catch (error) {
        console.error('Piyasa verileri alınırken hata oluştu:', error);
        // Avoid caching errors
        return NextResponse.json(
            { success: false, message: 'Sunucu Hatası: Piyasa verileri alınamadı.' },
            { status: 500 }
        );
    }
}
