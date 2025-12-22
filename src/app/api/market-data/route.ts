import { NextResponse } from 'next/server';
import axios from 'axios';
import 'dotenv/config';

// Define types for the expected API response and our standardized format
type CmcQuote = {
    name: string;
    symbol: string;
    quote: {
        USD: {
            price: number;
            percent_change_24h: number;
        };
    };
};

type FormattedTicker = {
    symbol: string;
    name: string;
    price: number;
    change: number;
};

// In-memory cache for tickers
let cachedData: { tickers: FormattedTicker[], timestamp: number, source: 'live' | 'static' } | null = null;
const CACHE_DURATION = 60000; // 60 seconds

// Hardcoded list of popular cryptocurrency symbols for the API call
const POPULAR_SYMBOLS = [
    "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "DOT", "MATIC", 
    "LINK", "SHIB", "LTC", "BCH", "TRX", "ATOM", "NEAR", "UNI", "FTM", "ICP",
    "ARB", "OP", "INJ", "RNDR", "TIA", "SUI", "APT", "HBAR", "VET", "FIL"
];

// Fallback data in case the live API fails
const getFallbackData = (): FormattedTicker[] => [
    { symbol: 'BTC', name: 'Bitcoin', price: 65000 + (Math.random() - 0.5) * 1000, change: (Math.random() - 0.5) * 5 },
    { symbol: 'ETH', name: 'Ethereum', price: 3500 + (Math.random() - 0.5) * 200, change: (Math.random() - 0.5) * 5 },
    { symbol: 'SOL', name: 'Solana', price: 150 + (Math.random() - 0.5) * 20, change: (Math.random() - 0.5) * 5 },
    { symbol: 'ARB', name: 'Arbitrum', price: 0.85 + (Math.random() - 0.5) * 0.1, change: (Math.random() - 0.5) * 5 },
    { symbol: 'BNB', name: 'BNB', price: 580 + (Math.random() - 0.5) * 30, change: (Math.random() - 0.5) * 5 },
    { symbol: 'XRP', name: 'XRP', price: 0.48 + (Math.random() - 0.5) * 0.05, change: (Math.random() - 0.5) * 5 },
    { symbol: 'ADA', name: 'Cardano', price: 0.40 + (Math.random() - 0.5) * 0.04, change: (Math.random() - 0.5) * 5 },
];


/**
 * Fetches the latest cryptocurrency data from CoinMarketCap API.
 * Uses an in-memory cache to avoid hitting API rate limits.
 * Provides a static fallback if the API is unavailable.
 */
export async function GET() {
    const now = Date.now();
    
    // 1. Serve from cache if data is fresh
    if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
        console.log(`[Market-Data] Serving ${cachedData.tickers.length} tickers from cache. Source: ${cachedData.source}`);
        return NextResponse.json({
            tickers: cachedData.tickers,
            source: cachedData.source,
        });
    }

    // 2. Check for API Key
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn('[Market-Data] CoinMarketCap API key (API_KEY) not found. Using fallback data.');
        const fallbackTickers = getFallbackData();
        cachedData = { tickers: fallbackTickers, timestamp: now, source: 'static' };
        return NextResponse.json({ tickers: fallbackTickers, source: 'static' });
    }
    
    // 3. Fetch from CoinMarketCap API
    try {
        console.log('[Market-Data] Fetching live data from CoinMarketCap API...');
        const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey,
                'Accept': 'application/json',
            },
            params: {
                symbol: POPULAR_SYMBOLS.join(','),
                convert: 'USD',
            },
        });

        const quotes: Record<string, CmcQuote> = response.data.data;
        
        // 4. Format the data to our standardized structure
        const formattedTickers: FormattedTicker[] = Object.values(quotes).map(quote => ({
            symbol: quote.symbol,
            name: quote.name,
            price: quote.quote.USD.price,
            change: quote.quote.USD.percent_change_24h,
        }));
        
        console.log(`[Market-Data] Successfully fetched ${formattedTickers.length} tickers from CMC.`);
        
        // 5. Update cache with live data
        cachedData = {
            tickers: formattedTickers,
            timestamp: now,
            source: 'live',
        };

        return NextResponse.json({
            tickers: formattedTickers,
            source: 'live',
        });

    } catch (error: any) {
        console.error('[Market-Data] Error fetching from CoinMarketCap API:', error.response?.data || error.message);
        
        console.warn('[Market-Data] Failed to fetch live data. Engaging fallback mechanism.');
        const fallbackTickers = getFallbackData();
        cachedData = { tickers: fallbackTickers, timestamp: now, source: 'static' };
        return NextResponse.json({ tickers: fallbackTickers, source: 'static' });
    }
}
