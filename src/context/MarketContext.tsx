
'use client';

import React, { createContext, useState, useEffect, ReactNode, useMemo } from 'react';

export type MarketCoin = {
  symbol: string;
  name: string;
  price: number;
  change: number;
};

type MarketContextType = {
  marketData: MarketCoin[];
  isLoading: boolean;
  source: 'live' | 'static' | null;
  error: string | null;
};

export const MarketContext = createContext<MarketContextType>({
  marketData: [],
  isLoading: true,
  source: null,
  error: null,
});

// Fallback data in case API fails
const FALLBACK_DATA: MarketCoin[] = [
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

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const [marketData, setMarketData] = useState<MarketCoin[]>(FALLBACK_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<'live' | 'static' | null>('static');
  const [error, setError] = useState<string | null>(null);

  // Initial data fetch
  useEffect(() => {
    const fetchMarketData = async () => {
      console.log("[MarketContext] Fetching initial market data...");
      setIsLoading(true);
      try {
        const response = await fetch('/api/market-data');
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();

        // --- STEP 2: Log the raw data received by the client ---
        console.log("[MarketContext] CLIENT_RECEIVED_RAW:", data);

        // --- STEP 3: Check data structure before setting state ---
        if (data && Array.isArray(data.tickers)) {
          console.log(`[MarketContext] Data is valid. Source: ${data.source}, Count: ${data.tickers.length}`);
          setMarketData(data.tickers);
          setSource(data.source);
          setError(null);
        } else {
          console.error("[MarketContext] Invalid data structure received:", data);
          throw new Error('Invalid or missing "tickers" array in API response.');
        }
      } catch (e: any) {
        console.error("[MarketContext] Error fetching or processing data:", e.message);
        console.log("[MarketContext] Using fallback data due to error.");
        setError(e.message);
        setSource('static');
        setMarketData(FALLBACK_DATA); // Use fallback data instead of empty array
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
  }, []);

  const value = useMemo(() => ({
    marketData,
    isLoading,
    source,
    error,
  }), [marketData, isLoading, source, error]);

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  );
};
