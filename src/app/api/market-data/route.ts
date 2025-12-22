
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
        { symbol: 'BTC', name: 'Bitcoin', price: 67015.78 + (Math.random() - 0.5) * 500, change: (Math.random() - 0.5) * 5 },
        { symbol: 'ETH', name: 'Ethereum', price: 3788.11 + (Math.random() - 0.5) * 200, change: (Math.random() - 0.5) * 5 },
        { symbol: 'SOL', name: 'Solana', price: 165.45 + (Math.random() - 0.5) * 20, change: (Math.random() - 0.5) * 5 },
        { symbol: 'ARB', name: 'Arbitrum', price: 0.95 + (Math.random() - 0.5) * 0.1, change: (Math.random() - 0.5) * 5 },
        { symbol: 'BNB', name: 'BNB', price: 601.30 + (Math.random() - 0.5) * 10, change: (Math.random() - 0.5) * 5 },
        { symbol: 'XRP', name: 'XRP', price: 0.49 + (Math.random() - 0.5) * 0.05, change: (Math.random() - 0.5) * 5 },
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
