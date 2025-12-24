import { useEffect, useRef, useState, useCallback } from 'react';

export type BinanceTicker = {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  lastUpdateTime: number;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseBinanceWebSocketReturn {
  tickers: Map<string, BinanceTicker>;
  status: ConnectionStatus;
  lastUpdate: Date | null;
  reconnect: () => void;
}

/**
 * Custom hook for Binance WebSocket real-time ticker updates
 * Connects to Binance WebSocket stream and provides live price data
 */
export function useBinanceWebSocket(): UseBinanceWebSocketReturn {
  const [tickers, setTickers] = useState<Map<string, BinanceTicker>>(new Map());
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setStatus('connecting');
    console.log('🔌 Connecting to Binance WebSocket...');

    try {
      // Binance WebSocket endpoint for all USDT tickers
      // Using mini ticker for better performance (updates every 1000ms)
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle array of tickers
          if (Array.isArray(data)) {
            const newTickers = new Map<string, BinanceTicker>();

            data.forEach((ticker: any) => {
              // Only process USDT pairs
              if (ticker.s && ticker.s.endsWith('USDT')) {
                // Format symbol as "BTC/USDT"
                const formattedSymbol = ticker.s.replace('USDT', '/USDT');

                newTickers.set(formattedSymbol, {
                  symbol: formattedSymbol,
                  price: ticker.c, // Close price
                  priceChange: ticker.p, // Price change
                  priceChangePercent: ticker.P, // Price change percent
                  volume: ticker.v || ticker.q, // Volume
                  lastUpdateTime: ticker.E || Date.now(), // Event time
                });
              }
            });

            setTickers(newTickers);
            setLastUpdate(new Date());
          }
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setStatus('disconnected');
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      setStatus('error');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    tickers,
    status,
    lastUpdate,
    reconnect,
  };
}
