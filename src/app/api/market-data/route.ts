
import { NextResponse } from 'next/server';
import axios from 'axios';

// Define types for our standardized format
type FormattedTicker = {
    symbol: string;
    name: string;
    price: number;
    change: number;
};

// --- STEP 3: Static Failover Data ---
// This is the guaranteed data that will be returned if the live API fails for any reason.
const getDebugFallbackData = (): FormattedTicker[] => {
    console.log('[Market-Data-API] DEBUG: Generating and returning static fallback data.');
    return [
        { symbol: 'BTC', name: 'Bitcoin', price: 67015.78, change: -1.25 },
        { symbol: 'ETH', name: 'Ethereum', price: 3788.11, change: 2.33 },
        { symbol: 'SOL', name: 'Solana', price: 165.45, change: -5.10 },
        { symbol: 'ARB', name: 'Arbitrum', price: 0.95, change: 1.50 },
        { symbol: 'BNB', name: 'BNB', price: 601.30, change: 0.55 },
        { symbol: 'XRP', name: 'XRP', price: 0.49, change: -2.05 },
    ];
};

/**
 * DEBUGGING STEP: This route handler is simplified to ALWAYS return a static
 * list of tickers. This helps isolate whether the problem is in data fetching (backend)
 * or data consumption (frontend).
 */
export async function GET() {
    console.log('[Market-Data-API] GET request received. Returning debug data.');
    
    const fallbackTickers = getDebugFallbackData();
    const dataToSend = { 
        tickers: fallbackTickers, 
        source: 'static' // Explicitly mark data source
    };

    // --- STEP 1: Log the exact data structure being sent ---
    console.log("[Market-Data-API] SERVER_SENDING_DATA:", JSON.stringify(dataToSend).substring(0, 200));

    return NextResponse.json(dataToSend);
}
