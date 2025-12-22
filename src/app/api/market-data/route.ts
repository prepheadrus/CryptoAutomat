
import { NextResponse } from 'next/server';
import ccxt from 'ccxt';

// Define types for our standardized format
type FormattedTicker = {
    symbol: string;
    name: string;
    price: number;
    change: number;
};

// Supported exchanges
const SUPPORTED_EXCHANGES = ['binance', 'kucoin', 'bybit', 'kraken', 'okx', 'gateio'] as const;
type ExchangeId = typeof SUPPORTED_EXCHANGES[number];

// Popular coins to show by default (top 50 by market cap)
const DEFAULT_SYMBOLS = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
    'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
    'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT', 'NEAR/USDT',
    'APT/USDT', 'ARB/USDT', 'OP/USDT', 'FIL/USDT', 'DOGE/USDT',
    'TRX/USDT', 'SHIB/USDT', 'TON/USDT', 'ICP/USDT', 'IMX/USDT',
    'AAVE/USDT', 'MKR/USDT', 'GRT/USDT', 'SAND/USDT', 'MANA/USDT',
    'ALGO/USDT', 'VET/USDT', 'ETC/USDT', 'XTZ/USDT', 'THETA/USDT',
    'FTM/USDT', 'EGLD/USDT', 'AXS/USDT', 'RUNE/USDT', 'STX/USDT',
    'INJ/USDT', 'SUI/USDT', 'SEI/USDT', 'TIA/USDT', 'WLD/USDT',
    'PEPE/USDT', 'BONK/USDT', 'FLOKI/USDT', 'ORDI/USDT', 'RNDR/USDT',
];

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
 * Fetch market data from specified exchange
 * Query params:
 * - exchange: Exchange ID (binance, kucoin, bybit, etc.) - default: binance
 * - search: Search query to filter symbols - optional
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const exchangeId = (searchParams.get('exchange') || 'binance') as ExchangeId;
    const searchQuery = searchParams.get('search')?.toLowerCase();

    console.log(`[Market-Data-API] GET request - Exchange: ${exchangeId}, Search: ${searchQuery || 'none'}`);

    // Validate exchange
    if (!SUPPORTED_EXCHANGES.includes(exchangeId)) {
        return NextResponse.json({
            tickers: getFallbackData(),
            source: 'static',
            error: `Unsupported exchange: ${exchangeId}`,
        }, { status: 400 });
    }

    try {
        // Initialize exchange
        const exchangeClass = ccxt[exchangeId];
        if (!exchangeClass) {
            throw new Error(`Exchange ${exchangeId} not available in CCXT`);
        }

        const exchange = new exchangeClass({
            enableRateLimit: true,
        });

        // Load all markets to get available symbols
        await exchange.loadMarkets();

        // Get USDT pairs only
        const usdtPairs = Object.keys(exchange.markets).filter(symbol =>
            symbol.endsWith('/USDT') && exchange.markets[symbol].active
        );

        console.log(`[Market-Data-API] Found ${usdtPairs.length} active USDT pairs on ${exchangeId}`);

        // Determine which symbols to fetch
        let symbolsToFetch: string[] = [];

        if (searchQuery) {
            // If search query provided, filter all USDT pairs
            symbolsToFetch = usdtPairs.filter(symbol => {
                const base = symbol.split('/')[0].toLowerCase();
                return base.includes(searchQuery) || symbol.toLowerCase().includes(searchQuery);
            }).slice(0, 100); // Limit to 100 results

            console.log(`[Market-Data-API] Search "${searchQuery}" found ${symbolsToFetch.length} matches`);
        } else {
            // No search - return default popular coins that exist on this exchange
            symbolsToFetch = DEFAULT_SYMBOLS.filter(symbol => usdtPairs.includes(symbol));
            console.log(`[Market-Data-API] Returning ${symbolsToFetch.length} default popular coins`);
        }

        if (symbolsToFetch.length === 0) {
            console.log('[Market-Data-API] No symbols to fetch, returning fallback');
            return NextResponse.json({
                tickers: getFallbackData(),
                source: 'static',
                exchange: exchangeId,
            });
        }

        // Fetch tickers
        const tickers = await exchange.fetchTickers(symbolsToFetch);

        // Format the data
        const formattedTickers: FormattedTicker[] = symbolsToFetch.map(symbol => {
            const ticker = tickers[symbol];
            if (!ticker) {
                return null;
            }

            return {
                symbol,
                name: symbol.split('/')[0], // Just use the base currency as name
                price: ticker.last || 0,
                change: ticker.percentage || 0,
            };
        }).filter((ticker): ticker is FormattedTicker => ticker !== null);

        console.log(`[Market-Data-API] Successfully fetched ${formattedTickers.length} tickers from ${exchangeId}`);

        return NextResponse.json({
            tickers: formattedTickers,
            source: 'live',
            exchange: exchangeId,
            totalAvailable: usdtPairs.length,
        });

    } catch (error: any) {
        console.error('[Market-Data-API] Error fetching live data:', error.message);
        console.log('[Market-Data-API] Returning fallback data due to error.');

        return NextResponse.json({
            tickers: getFallbackData(),
            source: 'static',
            exchange: exchangeId,
            error: error.message,
        });
    }
}
