
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Define types for our standardized format
type FormattedTicker = {
    symbol: string;
    name: string;
    price: number;
    change: number;
};

// Coin name mapping for popular symbols
const COIN_NAMES: Record<string, string> = {
    'BTC/USDT': 'Bitcoin',
    'ETH/USDT': 'Ethereum',
    'SOL/USDT': 'Solana',
    'XRP/USDT': 'XRP',
    'BNB/USDT': 'BNB',
    'DOGE/USDT': 'Dogecoin',
    'ADA/USDT': 'Cardano',
    'AVAX/USDT': 'Avalanche',
    'DOT/USDT': 'Polkadot',
    'MATIC/USDT': 'Polygon',
    'LINK/USDT': 'Chainlink',
    'UNI/USDT': 'Uniswap',
    'ATOM/USDT': 'Cosmos',
    'LTC/USDT': 'Litecoin',
    'BCH/USDT': 'Bitcoin Cash',
    'NEAR/USDT': 'NEAR Protocol',
    'APT/USDT': 'Aptos',
    'ARB/USDT': 'Arbitrum',
    'OP/USDT': 'Optimism',
    'FIL/USDT': 'Filecoin',
};

// Popular trading pairs to fetch
const SYMBOLS = Object.keys(COIN_NAMES);

// Fallback data in case API fails
const getFallbackData = (): FormattedTicker[] => {
    console.log('[Market-Data-API] Using fallback data.');
    return [
      { symbol: 'BTC/USDT', name: 'Bitcoin', price: 68530.24, change: 1.75 },
      { symbol: 'ETH/USDT', name: 'Ethereum', price: 3560.88, change: -0.45 },
      { symbol: 'SOL/USDT', name: 'Solana', price: 168.15, change: 3.10 },
      { symbol: 'XRP/USDT', name: 'XRP', price: 0.52, change: -1.20 },
      { symbol: 'BNB/USDT', name: 'BNB', price: 605.60, change: 0.88 },
      { symbol: 'DOGE/USDT', name: 'Dogecoin', price: 0.16, change: 5.55 },
      { symbol: 'ADA/USDT', name: 'Cardano', price: 0.45, change: 1.15 },
      { symbol: 'AVAX/USDT', name: 'Avalanche', price: 36.70, change: 2.80 },
      { symbol: 'DOT/USDT', name: 'Polkadot', price: 7.25, change: 0.50 },
      { symbol: 'MATIC/USDT', name: 'Polygon', price: 0.72, change: -2.35 },
    ];
};

/**
 * Fetch real-time market data from Binance using CCXT
 */
export async function GET() {
    console.log('[Market-Data-API] GET request received. Fetching live data from Binance...');

    try {
        // Initialize Binance exchange
        const exchange = new ccxt.binance({
            enableRateLimit: true,
        });

        // Fetch tickers for all symbols
        console.log('[Market-Data-API] Fetching tickers for', SYMBOLS.length, 'symbols...');
        const tickers = await exchange.fetchTickers(SYMBOLS);

        // Format the data
        const formattedTickers: FormattedTicker[] = SYMBOLS.map(symbol => {
            const ticker = tickers[symbol];
            if (!ticker) {
                console.warn(`[Market-Data-API] No data for ${symbol}, skipping.`);
                return null;
            }

            return {
                symbol,
                name: COIN_NAMES[symbol] || symbol.split('/')[0],
                price: ticker.last || 0,
                change: ticker.percentage || 0,
            };
        }).filter((ticker): ticker is FormattedTicker => ticker !== null);

        console.log(`[Market-Data-API] Successfully fetched ${formattedTickers.length} tickers from Binance.`);

        return NextResponse.json({
            tickers: formattedTickers,
            source: 'live',
        });

    } catch (error: any) {
        console.error('[Market-Data-API] Error fetching live data:', error.message);
        console.log('[Market-Data-API] Returning fallback data due to error.');

        return NextResponse.json({
            tickers: getFallbackData(),
            source: 'static',
        });
    }
}

