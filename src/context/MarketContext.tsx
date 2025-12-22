
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

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const [marketData, setMarketData] = useState<MarketCoin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<'live' | 'static' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initial data fetch
  useEffect(() => {
    const fetchMarketData = async () => {
      console.log("[MarketContext] Fetching initial market data...");
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
        } else {
          console.error("[MarketContext] Invalid data structure received:", data);
          throw new Error('Invalid or missing "tickers" array in API response.');
        }
      } catch (e: any) {
        console.error("[MarketContext] Error fetching or processing data:", e.message);
        setError(e.message);
        setSource('static'); 
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
