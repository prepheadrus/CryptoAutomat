
'use client';

import { useState, useEffect, useRef, memo, useId, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, Star, Heart, WifiOff, Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from '@/components/ui/skeleton';

type MarketCoin = {
  symbol: string;
  name: string;
  price: number;
  change: number;
};

declare global {
    interface Window {
        TradingView: any;
    }
}

// TradingView Iframe Embed - Force Binance by URL
const TradingViewWidget = memo(({ symbol }: { symbol: string }) => {
    // Format symbol for Binance - handle both "BTC/USDT" and "BTCUSDT" formats
    const upperSymbol = symbol.toUpperCase();
    const baseSymbol = upperSymbol.includes('/')
        ? upperSymbol.split('/')[0]  // "BTC/USDT" -> "BTC"
        : upperSymbol.replace(/USDT$/, ''); // "BTCUSDT" -> "BTC"

    const binanceSymbol = `BINANCE%3A${baseSymbol}USDT`;

    console.log('📊 TradingView iframe loading:', `BINANCE:${baseSymbol}USDT`);

    // TradingView iframe embed URL with forced Binance exchange
    const iframeUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${binanceSymbol}&interval=D&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=0&saveimage=0&toolbarbg=f1f3f6&theme=dark&style=1&timezone=Etc%2FUTC&locale=tr&allow_symbol_change=false`;

    return (
        <div className="tradingview-widget-container h-full w-full relative">
            <iframe
                key={symbol} // Force remount on symbol change
                src={iframeUrl}
                className="h-full w-full border-0"
                allowTransparency={true}
                scrolling="no"
                allowFullScreen={true}
                style={{
                    display: 'block',
                    height: '100%',
                    width: '100%',
                    margin: 0,
                    padding: 0,
                }}
            />
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
        </div>
    );
});

TradingViewWidget.displayName = 'TradingViewWidget';

// Memoized MarketList for performance
const MarketList = memo(({ coins, favorites, selectedSymbol, onSelectSymbol, onToggleFavorite, isLoading, searchQuery }: { 
    coins: MarketCoin[], 
    favorites: string[],
    selectedSymbol: string,
    onSelectSymbol: (symbol: string) => void,
    onToggleFavorite: (e: React.MouseEvent, symbol: string) => void,
    isLoading: boolean,
    searchQuery: string
}) => {
    if (isLoading) {
      return (
        <div className="p-2 space-y-2">
            {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[auto,1fr,1fr] gap-4 items-center p-1">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className='w-full'>
                        <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Skeleton className="h-5 w-24 justify-self-end" />
                        <Skeleton className="h-3 w-10 justify-self-end" />
                    </div>
                </div>
            ))}
        </div>
      );
    }
    
    if (coins.length === 0) {
        if(searchQuery) {
            return <p className="text-center text-muted-foreground p-8">"{searchQuery}" için sonuç bulunamadı.</p>
        }
        return (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center gap-2">
                <WifiOff className="h-6 w-6"/>
                <p>Veri Yüklenemedi</p>
                <p className="text-xs">Piyasa verileri alınamadı. Lütfen daha sonra tekrar deneyin.</p>
            </div>
        )
    }

    return (
        <ul>
            {coins.map((coin) => (
                <li key={coin.symbol}>
                    <button 
                        className={cn(
                            "w-full p-2 grid grid-cols-[auto,1fr,1fr] gap-4 items-center text-sm text-left hover:bg-slate-800/50 rounded-md transition-colors",
                            selectedSymbol === coin.symbol && "bg-primary/10 text-primary"
                        )}
                        onClick={() => onSelectSymbol(coin.symbol)}
                    >
                        <Star 
                            className={cn(
                                "h-4 w-4 text-muted-foreground/50 hover:text-yellow-400 transition-colors",
                                favorites.includes(coin.symbol) && "text-yellow-400 fill-yellow-400"
                            )}
                            onClick={(e) => onToggleFavorite(e, coin.symbol)}
                        />
                        <div className="flex flex-col">
                           <span className="font-bold">{coin.symbol}</span>
                           <span className="text-xs text-muted-foreground">{coin.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-mono">${coin.price < 0.01 ? coin.price.toPrecision(2) : coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className={cn(
                                "font-mono text-xs",
                                coin.change >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                                {coin.change.toFixed(2)}%
                            </span>
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    );
});
MarketList.displayName = 'MarketList';

export default function MarketTerminalPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<MarketCoin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<'live' | 'static'>('static');
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Load favorites from localStorage on initial render
  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem('marketFavorites');
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch (error) {
      console.error("Favoriler yüklenirken hata:", error);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('marketFavorites', JSON.stringify(favorites));
    } catch (error) {
      console.error("Favoriler kaydedilirken hata:", error);
    }
  }, [favorites]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch market data from Binance
  useEffect(() => {
    const fetchMarketData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          exchange: 'binance', // Binance only for now
        });

        if (debouncedSearchQuery) {
          params.append('search', debouncedSearchQuery);
        }

        const response = await fetch(`/api/market-data?${params.toString()}`);
        const data = await response.json();

        if (data && Array.isArray(data.tickers)) {
          setMarketData(data.tickers);
          setSource(data.source);
          setTotalAvailable(data.totalAvailable || 0);
        }
      } catch (err: any) {
        console.error('Error fetching market data:', err);
        setError(err.message || 'Veri yüklenirken hata oluştu');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
  }, [debouncedSearchQuery]);

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl && marketData.some(c => c.symbol === symbolFromUrl)) {
      setSelectedSymbol(symbolFromUrl);
    } else if (marketData.length > 0 && !marketData.some(c => c.symbol === selectedSymbol)) {
      setSelectedSymbol(marketData[0].symbol);
    }
  }, [searchParams, marketData, selectedSymbol]);

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    router.push(`/market?symbol=${symbol}`, { scroll: false });
  }

  const toggleFavorite = (e: React.MouseEvent, symbol: string) => {
      e.stopPropagation();
      setFavorites(prev => 
          prev.includes(symbol) 
              ? prev.filter(s => s !== symbol) 
              : [...prev, symbol]
      );
  }
  
  // TradingView logic: Show favorites when no search, show all results when searching
  const displayCoins = useMemo(() => {
    if (searchQuery || debouncedSearchQuery) {
      // When searching, show all results from API
      return marketData;
    }

    // No search - show only favorites if any, otherwise show popular coins
    if (favorites.length > 0) {
      return marketData.filter(coin => favorites.includes(coin.symbol));
    }

    // No favorites yet - show top popular coins from API
    return marketData;
  }, [searchQuery, debouncedSearchQuery, marketData, favorites]);

  const listTitle = searchQuery
    ? `Arama: "${searchQuery}"`
    : favorites.length > 0
      ? "Favoriler"
      : "Popüler Coinler";

  return (
    <div className="flex-1 flex flex-row overflow-hidden rounded-lg bg-slate-950 border border-slate-800 m-6">
        <aside className="w-1/3 max-w-sm flex-shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col">
            <div className="p-4 border-b border-slate-800 space-y-3">
                {/* Binance Market - Search & Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">Binance</span>
                    {totalAvailable > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {totalAvailable} coin
                      </span>
                    )}
                  </div>
                  {source === 'live' && (
                    <span className="text-xs text-green-500 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Canlı
                    </span>
                  )}
                </div>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Coin ara... (örn: BTC, ETH)"
                        className="bg-slate-800 border-slate-700 pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
                <div className="grid grid-cols-[auto,1fr,1fr] gap-4 p-2 border-b border-slate-800 text-xs text-muted-foreground sticky top-0 bg-slate-900 z-10">
                    <div className="w-4 pl-1">
                       <Heart className="h-3 w-3" />
                    </div>
                    <div className="font-semibold">{listTitle}</div>
                    <div className="text-right font-semibold">Fiyat / 24s Değişim</div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <MarketList
                        coins={displayCoins}
                        favorites={favorites}
                        selectedSymbol={selectedSymbol}
                        onSelectSymbol={handleSelectSymbol}
                        onToggleFavorite={toggleFavorite}
                        isLoading={isLoading}
                        searchQuery={searchQuery}
                    />
                </div>
            </div>
        </aside>

        {/* Right Panel: Chart and Actions */}
        <main className="flex-1 flex flex-col">
            <div className="flex h-16 items-center justify-between p-4 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-4">
                     <h1 className="text-xl font-headline font-bold text-white">{selectedSymbol}</h1>
                     {source === 'static' && !isLoading && (
                        <div className="flex items-center gap-2 text-xs text-amber-400">
                            <Activity className="h-4 w-4" />
                            <span>Simülasyon Modu</span>
                        </div>
                     )}
                     {error && (
                         <div className="flex items-center gap-2 text-xs text-red-400">
                            <WifiOff className="h-4 w-4" />
                            <span>{error}</span>
                        </div>
                     )}
                </div>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href={`/editor?symbol=${selectedSymbol}`}>
                        Bu Varlıkla Bot Oluştur <ArrowRight className="ml-2 h-4 w-4"/>
                    </Link>
                </Button>
            </div>
            <div className="flex-1 bg-background relative overflow-hidden min-h-0">
                <TradingViewWidget symbol={selectedSymbol} />
            </div>
        </main>
    </div>
  );
}
