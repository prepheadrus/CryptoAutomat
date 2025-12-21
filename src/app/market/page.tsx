
'use client';

import { useState, useEffect, useRef, memo, useId, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from '@/components/ui/skeleton';

declare global {
    interface Window {
        TradingView: any;
    }
}

type MarketCoin = {
  symbol: string;
  name: string;
  price: number;
  change: number;
};

// Memoized TradingView Widget to prevent re-renders on parent state changes
const TradingViewWidget = memo(({ symbol }: { symbol: string }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetId = useId();
    // By including the symbol in the ID, we ensure React creates a new div when the symbol changes.
    // This forces TradingView to create a completely new widget, avoiding state issues.
    const container_id = `tradingview_widget_${symbol}_${widgetId}`;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        let tvWidget: any = null;

        const createWidget = () => {
            if (typeof window.TradingView !== 'undefined') {
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
                    allow_symbol_change: false, // Important: We control the symbol from our UI
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
            // If script already exists, it might have loaded, so try to create widget
            createWidget();
        }

        return () => {
            // Cleanup on component unmount or symbol change
            if (tvWidget !== null) {
                try {
                    // TradingView provides a remove() method on the widget object
                    // but we don't have a stable reference to it across renders.
                    // Instead, we manually remove the iframe it creates.
                    const iframe = container.querySelector('iframe');
                    if (iframe) {
                        container.removeChild(iframe);
                    }
                } catch (error) {
                    console.error("Error cleaning up TradingView widget:", error);
                }
            }
        };
    }, [symbol, container_id]); // Re-run the effect if the symbol or the unique container_id changes

    // The key prop on the outer div ensures React replaces the div (and its children)
    // when the symbol changes, ensuring a clean slate for the TradingView widget.
    return (
        <div key={symbol} className="tradingview-widget-container h-full" ref={containerRef}>
            <div id={container_id} className="h-full" />
        </div>
    );
});

TradingViewWidget.displayName = 'TradingViewWidget';


export default function MarketTerminalPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [searchQuery, setSearchQuery] = useState("");
  const [marketData, setMarketData] = useState<MarketCoin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const symbolFromUrl = searchParams.get('symbol');
    if (symbolFromUrl) {
      setSelectedSymbol(symbolFromUrl);
    }
  }, [searchParams]);

  const fetchMarketData = useCallback(async () => {
      try {
          const response = await fetch('/api/market-data');
          if (!response.ok) {
              throw new Error('Piyasa verileri alınamadı');
          }
          const data = await response.json();
          setMarketData(data.tickers);
      } catch (error) {
          console.error(error);
          // Optionally, show a toast notification
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
      fetchMarketData(); // Initial fetch
      const interval = setInterval(fetchMarketData, 5000); // Fetch every 5 seconds
      return () => clearInterval(interval);
  }, [fetchMarketData]);


  const filteredMarkets = marketData.filter(coin =>
    coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    // Update URL without reloading the page
    router.push(`/market?symbol=${symbol}`, { scroll: false });
  }

  return (
    <div className="flex-1 flex flex-row overflow-hidden rounded-lg bg-slate-950 border border-slate-800">
        {/* Left Panel: Market List */}
        <aside className="w-1/4 flex-shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col">
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
            <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 gap-2 p-2 border-b border-slate-800 text-xs text-muted-foreground sticky top-0 bg-slate-900/50 z-10">
                    <div className="font-semibold">Sembol</div>
                    <div className="text-right font-semibold">Fiyat</div>
                    <div className="text-right font-semibold">24s Değişim</div>
                </div>
                {isLoading ? (
                    <div className="p-2 space-y-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                             <div key={i} className="grid grid-cols-3 gap-2 items-center">
                                <Skeleton className="h-5 w-12" />
                                <Skeleton className="h-5 w-20 justify-self-end" />
                                <Skeleton className="h-5 w-10 justify-self-end" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <ul>
                        {filteredMarkets.map((coin) => (
                            <li key={coin.symbol}>
                                <button 
                                    className={cn(
                                        "w-full p-2 grid grid-cols-3 gap-2 items-center text-sm text-left hover:bg-slate-800/50 rounded-md transition-colors",
                                        selectedSymbol === coin.symbol && "bg-primary/10 text-primary"
                                    )}
                                    onClick={() => handleSelectSymbol(coin.symbol)}
                                >
                                    <span className="font-bold">{coin.symbol}</span>
                                    <span className="font-mono text-right">${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <span className={cn(
                                        "font-mono text-right",
                                        coin.change >= 0 ? "text-green-500" : "text-red-500"
                                    )}>
                                        {coin.change.toFixed(2)}%
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
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
