import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CandlestickChart, AlertTriangle } from "lucide-react";
import ccxt from "ccxt";
import { cn } from "@/lib/utils";

type MarketData = {
  symbol: string;
  price: number;
  change: number;
  volume: number;
};

async function getMarketData(): Promise<{ data: MarketData[]; isDemo: boolean }> {
  const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "AVAX/USDT"];
  let isDemo = false;

  try {
    const exchange = new ccxt.binance();
    const tickers = await exchange.fetchTickers(symbols);

    if (!tickers || Object.keys(tickers).length === 0) {
      throw new Error("Borsadan veri alınamadı.");
    }
    
    const data: MarketData[] = Object.values(tickers).map((ticker) => ({
      symbol: ticker.symbol.replace('/USDT', ''),
      price: ticker.last ?? 0,
      change: ticker.percentage ?? 0,
      volume: ticker.quoteVolume ?? 0,
    }));

    return { data, isDemo };

  } catch (error) {
    console.warn("Binance API'sine erişilemedi, simülasyon verileri kullanılıyor:", error);
    isDemo = true;
    const demoData: MarketData[] = [
      { symbol: "BTC", price: 68543.21 + (Math.random() - 0.5) * 1000, change: (Math.random() - 0.4) * 5, volume: 2500000000 + Math.random() * 500000000 },
      { symbol: "ETH", price: 3567.89 + (Math.random() - 0.5) * 100, change: (Math.random() - 0.6) * 6, volume: 1200000000 + Math.random() * 200000000 },
      { symbol: "SOL", price: 165.43 + (Math.random() - 0.5) * 10, change: (Math.random() - 0.3) * 8, volume: 800000000 + Math.random() * 100000000 },
      { symbol: "BNB", price: 598.12 + (Math.random() - 0.5) * 20, change: (Math.random() - 0.5) * 4, volume: 450000000 + Math.random() * 50000000 },
      { symbol: "AVAX", price: 36.78 + (Math.random() - 0.5) * 5, change: (Math.random() - 0.2) * 10, volume: 300000000 + Math.random() * 40000000 },
    ];
    return { data: demoData, isDemo };
  }
}

export default async function MarketPage() {
  const { data, isDemo } = await getMarketData();

  return (
    <div className="space-y-6">
      {isDemo && (
        <Alert variant="destructive" className="bg-yellow-800/20 border-yellow-700 text-yellow-300 [&>svg]:text-yellow-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Demo Modu Aktif</AlertTitle>
          <AlertDescription>
            Canlı borsa verileri alınamadı. Şu anda simülasyon verileri gösterilmektedir.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
             <CandlestickChart className="h-6 w-6 text-primary" />
             <CardTitle className="font-headline text-2xl">Canlı Kripto Piyasası</CardTitle>
          </div>
          <CardDescription>Popüler kripto varlıkların anlık piyasa verileri</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Sembol</TableHead>
                <TableHead>Fiyat</TableHead>
                <TableHead>24s Değişim</TableHead>
                <TableHead className="text-right">24s Hacim (USDT)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((coin) => (
                <TableRow key={coin.symbol}>
                  <TableCell className="font-bold text-lg">{coin.symbol}</TableCell>
                  <TableCell className="font-mono">${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  <TableCell
                    className={cn(
                      "font-semibold",
                      coin.change >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {coin.change.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right font-mono">${coin.volume.toLocaleString('en-US', { notation: 'compact', compactDisplay: 'short' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
