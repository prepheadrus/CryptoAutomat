import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Terminal, Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const bots = [
    { id: 1, name: "BTC Momentum Scalper", status: "Running", pnl: 250.75, trades: 42, strategy: "RSI Oversold" },
    { id: 2, name: "ETH/BTC Arbitrage", status: "Paused", pnl: -50.20, trades: 15, strategy: "Cross-Exchange Spread" },
    { id: 3, name: "SOL Trend Follower", status: "Error", pnl: 0, trades: 0, strategy: "MA Crossover" },
]

export default function BotStatusPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-headline font-bold">Bot Durumu</h1>
              <Button>
                <Play className="mr-2 h-4 w-4" /> Yeni Bot Başlat
              </Button>
            </div>
            
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {bots.map((bot) => (
                    <Card key={bot.id} className="flex flex-col">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="font-headline text-xl flex items-center gap-2"><Bot className="h-5 w-5 text-primary"/> {bot.name}</CardTitle>
                                    <CardDescription className="pt-2">
                                        <Badge variant={
                                            bot.status === 'Running' ? 'default' : 
                                            bot.status === 'Paused' ? 'secondary' : 'destructive'
                                        }>{bot.status}</Badge>
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="icon">
                                    {bot.status === 'Running' ? <Pause className="h-4 w-4"/> : <Play className="h-4 w-4"/>}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Strateji</span>
                                <span>{bot.strategy}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">7g K&Z</span>
                                <span className={bot.pnl >= 0 ? 'text-primary' : 'text-destructive'}>
                                    {bot.pnl >= 0 ? '+' : ''}${Math.abs(bot.pnl).toFixed(2)}
                                </span>
                            </div>
                             <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">İşlemler (7g)</span>
                                <span>{bot.trades}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2"><Terminal className="h-5 w-5" /> Genel Bot Kayıtları</CardTitle>
                    <CardDescription>Tüm stratejilerdeki bot aktivitelerinin canlı yayını.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-black rounded-lg p-4 font-mono text-sm text-white/90 h-80 overflow-y-auto space-y-1">
                        <p><span className="text-foreground">[BİLGİ]</span> [10:00:00] "BTC Momentum Scalper" botu başlatıldı.</p>
                        <p><span className="text-accent">[İŞLEM]</span> [10:05:12] 0.1 BTC @ 68123.45 USD ALINDI.</p>
                        <p><span className="text-accent">[İŞLEM]</span> [10:15:30] 0.1 BTC @ 68456.78 USD SATILDI. K&Z: +$33.33</p>
                        <p><span className="text-muted-foreground">[UYARI]</span> [10:18:00] Binance'de ETH/BTC çifti için yüksek kayma tespit edildi.</p>
                        <p><span className="text-destructive">[HATA]</span> [10:20:00] "SOL Trend Follower" botu Kraken API'sine bağlanamadı.</p>
                        <p><span className="text-foreground">[BİLGİ]</span> [10:22:00] "ETH/BTC Arbitrage" botu kullanıcı tarafından duraklatıldı.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
