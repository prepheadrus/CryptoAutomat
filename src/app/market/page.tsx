'use client';

import { useState, useEffect, useRef, memo, useId, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, Star, Heart, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from '@/components/ui/skeleton';

declare global {
    interface Window {
        TradingView: any;
    }
}

type MarketCoin = {
  symbol: string; // Base currency, e.g., 'BTC'
  name: string; // Full name, e.g., 'Bitcoin'
  price: number;
  change: number;
};

// Memoized TradingView Widget to prevent re-renders on parent state changes
const TradingViewWidget = memo(({ symbol }: { symbol: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetId = useId();
    const container_id = `tradingview_widget_${symbol}_${widgetId}`;

    useEffect(() => {
        let tvWidget: any = null;

        const createWidget = () => {
            if (document.getElementById(container_id) && typeof window.TradingView !== 'undefined') {
                tvWidget = new window.TradingView.widget({
                    autosize: true,
                    symbol: `BINANCE:${symbol.toUpperCase()}USDT`,
                    interval: "D",
                    timezone: "Etc/UTC",
                    theme: "dark",
                    style: "1",
                    locale: "tr",
                    enable_publishing: false,
                    withdateranges: true,
                    hide_side_toolbar: false,
                    allow_symbol_change: false, // We control the symbol from our UI
                    container_id: container_id
                });
            }
        }

        const scriptId = 'tradingview-widget-script';
        const existingScript = document.getElementById(scriptId);

        if (!existingScript) {
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://s3.tradingview.com/tv.js";
            script.type = "text/javascript";
            script.async = true;
            script.onload = createWidget;
            document.body.appendChild(script);
        } else {
            createWidget();
        }

        return () => {
             const widgetContainer = document.getElementById(container_id);
             if (widgetContainer) {
                const iframe = widgetContainer.querySelector('iframe');
                if (iframe && iframe.parentNode) {
                   try {
                     iframe.parentNode.removeChild(iframe);
                   } catch (error) {
                       console.error("Error cleaning up TradingView widget:", error);
                   }
                }
            }
        };
    }, [symbol, container_id]);

    return (
        <div key={symbol} className="tradingview-widget-container h-full" ref={containerRef}>
            <div id={container_id} className="h-full" />
        </div>
    );
});

TradingViewWidget.displayName = 'TradingViewWidget';

// Memoized MarketList for performance
const MarketList = memo(({ coins, favorites, selectedSymbol, onSelectSymbol, onToggleFavorite, isLoading, searchQuery, hasData }: { 
    coins: MarketCoin[], 
    favorites: string[],
    selectedSymbol: string,
    onSelectSymbol: (symbol: string) => void,
    onToggleFavorite: (e: React.MouseEvent, symbol: string) => void,
    isLoading: boolean,
    searchQuery: string,
    hasData: boolean,
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
        // No data from API at all
        if (!hasData) {
            return (
                <div className="text-center text-muted-foreground p-8 flex flex-col items-center gap-2">
                    <WifiOff className="h-8 w-8 text-destructive"/>
                    <p className='font-semibold text-foreground'>Veri Alınamadı</p>
                    <p className="text-xs">Piyasa verileri sunucusuna ulaşılamıyor. Lütfen daha sonra tekrar deneyin.</p>
                </div>
            );
        }
        // Has data, but search returned no results
        if(searchQuery) {
            return <p className="text-center text-muted-foreground p-8">"{searchQuery}" için sonuç bulunamadı.</p>
        }
        // Has data, search is empty, but no favorites
        return (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center gap-2">
                <Heart className="h-6 w-6"/>
                <p>Henüz favoriniz yok.</p>
                <p className="text-xs">Bir varlığı favorilere eklemek için arama yapın ve yıldız ikonuna tıklayın.</p>
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
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [searchQuery, setSearchQuery] = useState("");
  const [marketData, setMarketData] = useState<MarketCoin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  
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
    } catch (error)      {
      console.error("Favoriler kaydedilirken hata:", error);
    }
  }, [favorites]);

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl) {
      setSelectedSymbol(symbolFromUrl.replace('USDT', ''));
    }
  }, [searchParams]);

  const fetchMarketData = useCallback(async () => {
      try {
          console.log("[Market-Data-Client] Veri çekiliyor...");
          const response = await fetch('/api/market-data');
          if (!response.ok) {
              throw new Error('Piyasa verileri alınamadı');
          }
          const data = await response.json();
          if (data && data.tickers) {
             console.log(`[Market-Data-Client] Alınan coin sayısı: ${data.tickers.length}`);
             setMarketData(data.tickers);
          } else {
             setMarketData([]);
          }
      } catch (error) {
          console.error(error);
          setMarketData([]); // Set to empty on error
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
      fetchMarketData(); // Initial fetch
      const interval = setInterval(fetchMarketData, 5000); // Fetch every 5 seconds
      return () => clearInterval(interval);
  }, [fetchMarketData]);


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
  
  const filteredCoins = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    // If there is a search query, filter all market data
    if (query) {
      return marketData.filter(coin => 
        coin.symbol.toLowerCase().includes(query) || 
        coin.name.toLowerCase().includes(query)
      );
    }
    
    // If search is empty, show only favorite coins
    return marketData.filter(coin => favorites.includes(coin.symbol));
    
  }, [searchQuery, marketData, favorites]);


  return (
    <div className="flex-1 flex flex-row overflow-hidden rounded-lg bg-slate-950 border border-slate-800">
        <aside className="w-1/3 max-w-sm flex-shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col">
            <div className="p-4 border-b border-slate-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Piyasa ara..."
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
                    <div className="font-semibold">{searchQuery ? 'Arama Sonuçları' : 'Favoriler'}</div>
                    <div className="text-right font-semibold">Fiyat / 24s Değişim</div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <MarketList 
                        coins={filteredCoins} 
                        favorites={favorites}
                        selectedSymbol={selectedSymbol}
                        onSelectSymbol={handleSelectSymbol}
                        onToggleFavorite={toggleFavorite}
                        isLoading={isLoading}
                        searchQuery={searchQuery}
                        hasData={marketData.length > 0}
                    />
                </div>
            </div>
        </aside>

        {/* Right Panel: Chart and Actions */}
        <main className="flex-1 flex flex-col">
            <div className="flex h-16 items-center justify-between p-4 border-b border-slate-800 shrink-0">
                <h1 className="text-xl font-headline font-bold text-white">{selectedSymbol}/USDT</h1>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href={`/editor?symbol=${selectedSymbol}USDT`}>
                        Bu Varlıkla Bot Oluştur <ArrowRight className="ml-2 h-4 w-4"/>
                    </Link>
                </Button>
            </div>
            <div className="flex-1 bg-background relative">
                <TradingViewWidget symbol={selectedSymbol} />
            </div>
        </main>
    </div>
  );
}
