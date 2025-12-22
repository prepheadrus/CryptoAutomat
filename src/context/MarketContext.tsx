
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
          throw new Error('API request failed');
        }
        const data = await response.json();
        if (data && data.tickers) {
          console.log(`[MarketContext] Initial data loaded. Source: ${data.source}`);
          setMarketData(data.tickers);
          setSource(data.source);
        } else {
          throw new Error('Invalid data structure from API');
        }
      } catch (e: any) {
        console.error("[MarketContext] Error fetching initial data:", e.message);
        setError(e.message);
        // The API route should provide its own fallback, but we can have one here too
        setSource('static'); // Assume static if fetch fails
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
  }, []);

  // Real-time data simulation/polling
  useEffect(() => {
    if (isLoading) return; // Don't start interval until initial load is done

    const intervalId = setInterval(async () => {
      try {
        // Fetch fresh data from the API endpoint
        const response = await fetch('/api/market-data');
        const data = await response.json();
        
        if (data && data.tickers) {
           setMarketData(data.tickers);
           setSource(data.source);
           setError(null); // Clear previous errors on success
        }

      } catch (e: any) {
         console.warn('[MarketContext] Interval fetch failed, relying on existing data.', e.message);
         setError(e.message);
         // Don't clear data, just let the user know there's an issue
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [isLoading]);


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
