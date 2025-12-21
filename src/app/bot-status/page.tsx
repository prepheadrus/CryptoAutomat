'use client';

import { useState, MouseEvent, useEffect, useMemo, useRef, useCallback } from "react";
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Terminal, Bot, Settings, PlusCircle, Trash2, Eye, X as XIcon, AreaChart as AreaChartIcon, FileText, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Bot as BotType, Log, BotStatus, BotConfig } from "@/lib/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const initialBots: BotType[] = [
    { id: 1, name: "BTC-RSI Stratejisi", pair: "BTC/USDT", status: "Çalışıyor", pnl: 12.5, duration: "2g 5sa", config: { mode: 'PAPER', stopLoss: 2, takeProfit: 5, trailingStop: false, amountType: 'fixed', amount: 100, leverage: 5, initialBalance: 10000, currentBalance: 11250, inPosition: true, entryPrice: 65000, positionSize: 0.1 } },
    { id: 2, name: "ETH-MACD Scalp", pair: "ETH/USDT", status: "Durduruldu", pnl: -3.2, duration: "12sa 15dk", config: { mode: 'LIVE', stopLoss: 1.5, takeProfit: 3, trailingStop: true, amountType: 'percentage', amount: 10, leverage: 10 } },
    { id: 3, name: "SOL-Trend Follow", pair: "SOL/USDT", status: "Çalışıyor", pnl: 8.9, duration: "5g 1sa", config: { mode: 'PAPER', stopLoss: 5, takeProfit: 10, trailingStop: false, amountType: 'fixed', amount: 250, leverage: 3, initialBalance: 10000, currentBalance: 10890, inPosition: false } },
    { id: 4, name: "AVAX Arbitraj", pair: "AVAX/USDT", status: "Hata", pnl: 0, duration: "1sa", config: { mode: 'LIVE', stopLoss: 3, takeProfit: 6, trailingStop: false, amountType: 'fixed', amount: 50, leverage: 1 } },
];

type LogType = 'info' | 'trade' | 'warning' | 'error';

const initialLogs: Log[] = [
    { type: 'info', message: '[10:00:00] "BTC-RSI Stratejisi" [PAPER] botu başlatıldı.' },
    { type: 'trade', message: '[10:05:12] [PAPER] 0.1 BTC @ 68123.45 USDT ALINDI.' },
    { type: 'trade', message: '[10:15:30] [PAPER] 0.1 BTC @ 68456.78 USDT SATILDI. K&Z: +$33.33' },
    { type: 'warning', message: "[10:18:00] Binance'de ETH/USDT çifti için yüksek kayma tespit edildi." },
    { type: 'error', message: '[10:20:00] "AVAX Arbitraj" botu Kraken API\'sine bağlanamadı.' },
    { type: 'info', message: '[10:22:00] "ETH-MACD Scalp" botu kullanıcı tarafından duraklatıldı.' },
];

const logTypeConfig: Record<LogType, string> = {
    info: "text-foreground",
    trade: "text-accent",
    warning: "text-yellow-400",
    error: "text-destructive",
};

const statusConfig: Record<BotStatus, { badge: "default" | "secondary" | "destructive", dot: string, icon: JSX.Element, action: string }> = {
    "Çalışıyor": { badge: "default", dot: "bg-green-500 animate-pulse", icon: <Pause className="h-4 w-4" />, action: "Durdur" },
    "Durduruldu": { badge: "secondary", dot: "bg-gray-500", icon: <Play className="h-4 w-4" />, action: "Başlat" },
    "Hata": { badge: "destructive", dot: "bg-red-500", icon: <Play className="h-4 w-4" />, action: "Tekrar Dene" }
};

// Helper to generate mock performance data for the detail panel chart
const generateBotPerformanceData = (pnl: number) => {
    const data = [];
    let value = 1000; // Start with a base value
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            name: date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
            profit: value,
        });
        const fluctuation = pnl > 0 ? (Math.random() * 0.02) : (Math.random() * 0.01 - 0.005);
        value *= (1 + (pnl / 100 / 30) + fluctuation);
    }
    return data;
};

export default function BotStatusPage() {
    const [bots, setBots] = useState<BotType[]>([]);
    const [logs, setLogs] = useState<Log[]>(initialLogs);
    const [isClient, setIsClient] = useState(false);
    const [selectedBot, setSelectedBot] = useState<BotType | null>(null);
    const [editedConfig, setEditedConfig] = useState<BotConfig | undefined>(undefined);
    const { toast } = useToast();
    const intervalRefs = useRef<Record<number, NodeJS.Timeout>>({});
    
    // Function to add a new log entry
    const addLog = useCallback((type: LogType, message: string) => {
        const timestamp = new Date().toLocaleTimeString('tr-TR', { hour12: false });
        setLogs(prevLogs => [{ type, message: `[${timestamp}] ${message}` }, ...prevLogs].slice(0, 100));
    }, []);

    // Paper Trading Simulation
    const runPaperTradeSimulation = useCallback((bot: BotType) => {
        const decision = Math.random() > 0.5 ? 'buy' : 'sell';
        const currentPrice = 65000 + (Math.random() - 0.5) * 2000;

        setBots(prevBots => {
            const updatedBots = prevBots.map(b => {
                if (b.id !== bot.id) return b;
                
                let newPnl = b.pnl;
                let logMessage = `[${b.name}] [PAPER] için simülasyon adımı. Karar: BEKLE.`;
                const config = b.config;
                let newConfig = { ...config };

                if (config.inPosition && decision === 'sell') {
                    const profit = (currentPrice - (config.entryPrice || currentPrice)) * (config.positionSize || 0);
                    newPnl += (profit / (config.initialBalance || 10000)) * 100;
                    logMessage = `[${b.name}] [PAPER] SATIŞ @ ${currentPrice.toFixed(2)}. K&Z: ${profit.toFixed(2)}$`;
                    addLog('trade', logMessage);
                    newConfig = { ...newConfig, inPosition: false, entryPrice: undefined, currentBalance: (config.currentBalance || 0) + profit };
                } else if (!config.inPosition && decision === 'buy') {
                    logMessage = `[${b.name}] [PAPER] ALIŞ @ ${currentPrice.toFixed(2)}.`;
                    addLog('trade', logMessage);
                    const positionSize = (config.amount || 100) / currentPrice;
                    newConfig = { ...newConfig, inPosition: true, entryPrice: currentPrice, positionSize };
                }

                return { ...b, pnl: newPnl, config: newConfig };
            });
            return updatedBots;
        });
    }, [addLog]);


    useEffect(() => {
        setIsClient(true);
        try {
            const storedBots = localStorage.getItem('myBots');
            if (storedBots) {
                const parsedBots: BotType[] = JSON.parse(storedBots);
                const botsWithDefaults = parsedBots.map(bot => ({
                    ...bot,
                    config: {
                        ...initialBots[0].config,
                        ...bot.config,
                    }
                }));
                setBots(botsWithDefaults);
            } else {
                setBots(initialBots);
            }
        } catch (error) {
            console.error("Botlar localStorage'dan yüklenirken hata:", error);
            setBots(initialBots);
        }

        // Cleanup on unmount
        return () => {
            Object.values(intervalRefs.current).forEach(clearInterval);
        };
    }, []);

    // Effect to manage simulation intervals
    useEffect(() => {
        bots.forEach(bot => {
            if (bot.status === 'Çalışıyor' && bot.config.mode === 'PAPER' && !intervalRefs.current[bot.id]) {
                // Start simulation for this bot
                intervalRefs.current[bot.id] = setInterval(() => {
                    runPaperTradeSimulation(bot);
                }, 5000 + Math.random() * 2000); // Stagger intervals
            } else if ((bot.status !== 'Çalışıyor' || bot.config.mode !== 'PAPER') && intervalRefs.current[bot.id]) {
                // Stop simulation for this bot
                clearInterval(intervalRefs.current[bot.id]);
                delete intervalRefs.current[bot.id];
            }
        });
    }, [bots, runPaperTradeSimulation]);

    useEffect(() => {
        if (isClient) {
            try {
                localStorage.setItem('myBots', JSON.stringify(bots));
            } catch (error) {
                console.error("Botlar localStorage'a kaydedilirken hata:", error);
            }
        }
    }, [bots, isClient]);

    useEffect(() => {
        if (selectedBot) {
            setEditedConfig(selectedBot.config);
        } else {
            setEditedConfig(undefined);
        }
    }, [selectedBot]);


    const handleToggleStatus = (e: MouseEvent, botId: number) => {
        e.stopPropagation();
        setBots(bots.map(bot => {
            if (bot.id === botId) {
                if (bot.status === "Çalışıyor") {
                    addLog('info', `"${bot.name}" botu kullanıcı tarafından durduruldu.`);
                    return { ...bot, status: "Durduruldu" as BotStatus };
                } else {
                    addLog('info', `"${bot.name}" botu kullanıcı tarafından başlatıldı.`);
                    return { ...bot, status: "Çalışıyor" as BotStatus };
                }
            }
            return bot;
        }));
    };

    const handleDeleteBot = (e: MouseEvent, botId: number) => {
        e.stopPropagation();
        const botToDelete = bots.find(bot => bot.id === botId);
        if (botToDelete && window.confirm(`"${botToDelete.name}" adlı botu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            // Stop simulation if it's running
            if (intervalRefs.current[botId]) {
                clearInterval(intervalRefs.current[botId]);
                delete intervalRefs.current[botId];
            }
            setBots(prev => prev.filter(bot => bot.id !== botId));
            addLog('warning', `Bot silindi: "${botToDelete.name}"`);
        }
    };
    
    const handleViewDetails = (e: MouseEvent, bot: BotType) => {
        e.stopPropagation();
        setSelectedBot(bot);
    }

    const handleConfigChange = (field: keyof BotConfig, value: any) => {
        if (editedConfig) {
            setEditedConfig(prev => ({...prev!, [field]: value}));
        }
    }

    const handleUpdateConfig = () => {
        if (!selectedBot || !editedConfig) return;

        setBots(prevBots => prevBots.map(bot => 
            bot.id === selectedBot.id ? { ...bot, config: editedConfig } : bot
        ));

        toast({
            title: "Ayarlar Güncellendi",
            description: `"${selectedBot.name}" botunun konfigürasyonu kaydedildi.`,
        });

        setSelectedBot(prev => prev ? {...prev, config: editedConfig} : null);
    }
    
    const botPerformanceData = useMemo(() => {
        return selectedBot ? generateBotPerformanceData(selectedBot.pnl) : [];
    }, [selectedBot]);


    return (
        <div className="flex flex-col h-full p-4 md:p-6 bg-background overflow-y-auto space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-headline font-bold">Aktif Botlarım</h1>
              <Button asChild>
                <Link href="/editor">
                  <PlusCircle className="mr-2 h-4 w-4" /> Yeni Bot Oluştur
                </Link>
              </Button>
            </div>
            
            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {bots.map((bot) => {
                    const config = statusConfig[bot.status];
                    return (
                        <Card key={bot.id} className="flex flex-col border-l-4 border-transparent data-[status=Çalışıyor]:border-primary data-[status=Hata]:border-destructive transition-all hover:shadow-lg" data-status={bot.status}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="font-headline text-xl flex items-center gap-2">
                                            <Bot className="h-5 w-5 text-primary"/> {bot.name}
                                        </CardTitle>
                                        <CardDescription className="pt-2 flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", config.dot)}></div>
                                            <Badge variant={config.badge}>{bot.status}</Badge>
                                            {bot.config.mode === 'PAPER' && <Badge variant="outline" className="border-amber-500 text-amber-500">PAPER</Badge>}
                                            <span className="text-muted-foreground font-mono text-xs">{bot.pair}</span>
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={(e) => handleViewDetails(e, bot)} aria-label="Detaylar">
                                            <Eye className="h-4 w-4"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={(e) => handleToggleStatus(e, bot.id)} aria-label={config.action}>
                                            {config.icon}
                                        </Button>
                                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => handleDeleteBot(e, bot.id)} aria-label="Sil">
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-sm text-muted-foreground">Toplam K&Z</span>
                                    <span className={cn("text-lg font-bold", bot.pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                                        {bot.pnl >= 0 ? '+' : ''}{bot.pnl.toFixed(2)}%
                                    </span>
                                </div>
                                 <div className="flex flex-col">
                                    <span className="text-sm text-muted-foreground">Çalışma Süresi</span>
                                    <span className="text-lg font-bold">{bot.duration}</span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                 {bots.length === 0 && (
                    <div className="lg:col-span-2 xl:col-span-3 text-center text-muted-foreground py-16">
                        <Bot className="mx-auto h-12 w-12 mb-4"/>
                        <h3 className="text-xl font-semibold">Henüz aktif botunuz yok.</h3>
                        <p className="mt-2">Hemen bir tane oluşturarak kazanmaya başlayın!</p>
                         <Button asChild className="mt-4">
                            <Link href="/editor">
                            <PlusCircle className="mr-2 h-4 w-4" /> Yeni Bot Oluştur
                            </Link>
                        </Button>
                    </div>
                 )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2"><Terminal className="h-5 w-5" /> Genel Bot Kayıtları</CardTitle>
                    <CardDescription>Tüm stratejilerdeki bot aktivitelerinin canlı yayını.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-black rounded-lg p-4 font-mono text-sm text-white/90 h-64 overflow-y-auto space-y-1 flex flex-col-reverse">
                       <div>
                         {logs.map((log, index) => (
                            <p key={index}><span className={cn(logTypeConfig[log.type], "font-bold")}>[{log.type.toUpperCase()}]</span> {log.message}</p>
                        ))}
                       </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bot Detay Paneli (Sheet) */}
            <Sheet open={!!selectedBot} onOpenChange={(isOpen) => !isOpen && setSelectedBot(null)}>
                <SheetContent className="w-[400px] sm:w-[540px] bg-slate-900 border-slate-800 text-white p-0">
                    {selectedBot && (
                        <>
                            <SheetHeader className="p-6">
                                <SheetTitle className="font-headline text-2xl flex items-center gap-3">
                                    <Bot className="h-6 w-6 text-primary" /> {selectedBot.name}
                                </SheetTitle>
                                <div className="text-sm text-muted-foreground flex items-center gap-4 pt-2">
                                     <span className="text-muted-foreground font-mono">{selectedBot.pair}</span>
                                     <Badge variant={statusConfig[selectedBot.status].badge}>{selectedBot.status}</Badge>
                                     {selectedBot.config.mode === 'PAPER' && <Badge variant="outline" className="border-amber-500 text-amber-500">PAPER</Badge>}
                                </div>
                            </SheetHeader>
                            <Tabs defaultValue="overview" className="w-full">
                                <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 mx-6">
                                    <TabsTrigger value="overview"><AreaChartIcon className="mr-2 h-4 w-4" />Genel Bakış</TabsTrigger>
                                    <TabsTrigger value="performance"><Activity className="mr-2 h-4 w-4"/>Performans</TabsTrigger>
                                    <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Ayarlar</TabsTrigger>
                                </TabsList>
                                <TabsContent value="overview" className="p-6">
                                    <div className="space-y-6">
                                        <Card className="bg-slate-800/50">
                                            <CardHeader><CardTitle className="text-base font-semibold">Portföy Değeri (Son 30 Gün)</CardTitle></CardHeader>
                                            <CardContent className="h-48">
                                                 <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={botPerformanceData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                                        <defs>
                                                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={selectedBot.pnl >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity={0.8}/>
                                                                <stop offset="95%" stopColor={selectedBot.pnl >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stopOpacity={0.1}/>
                                                            </linearGradient>
                                                        </defs>
                                                        <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickFormatter={(val) => `$${(val/1000).toFixed(1)}k`}/>
                                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.5rem' }} />
                                                        <Area type="monotone" dataKey="profit" stroke={selectedBot.pnl >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} fill="url(#colorProfit)" strokeWidth={2} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Card className="bg-slate-800/50"><CardHeader><CardDescription>Toplam K&Z</CardDescription><CardTitle className={cn(selectedBot.pnl >= 0 ? "text-green-400" : "text-red-400")}>{selectedBot.pnl.toFixed(2)}%</CardTitle></CardHeader></Card>
                                            <Card className="bg-slate-800/50"><CardHeader><CardDescription>Çalışma Süresi</CardDescription><CardTitle>{selectedBot.duration}</CardTitle></CardHeader></Card>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="performance" className="p-6">
                                     <div className="grid grid-cols-2 gap-4">
                                        <Card className="bg-slate-800/50"><CardHeader><CardDescription>Toplam İşlem</CardDescription><CardTitle>142</CardTitle></CardHeader></Card>
                                        <Card className="bg-slate-800/50"><CardHeader><CardDescription>Başarı Oranı</CardDescription><CardTitle>72%</CardTitle></CardHeader></Card>
                                        <Card className="bg-slate-800/50"><CardHeader><CardDescription>Sharpe Oranı</CardDescription><CardTitle>1.82</CardTitle></CardHeader></Card>
                                        <Card className="bg-slate-800/50"><CardHeader><CardDescription>Maks. Düşüş</CardDescription><CardTitle className="text-red-400">-8.15%</CardTitle></CardHeader></Card>
                                    </div>
                                </TabsContent>
                                <TabsContent value="settings" className="p-6">
                                    {editedConfig ? (
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-semibold mb-3">Risk Yönetimi</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Stop Loss (%)</Label><Input type="number" value={editedConfig.stopLoss} onChange={(e) => handleConfigChange('stopLoss', parseFloat(e.target.value))} className="bg-slate-800 border-slate-700"/></div>
                                                    <div className="space-y-2"><Label>Take Profit (%)</Label><Input type="number" value={editedConfig.takeProfit} onChange={(e) => handleConfigChange('takeProfit', parseFloat(e.target.value))} className="bg-slate-800 border-slate-700"/></div>
                                                </div>
                                            </div>
                                             <div>
                                                <h4 className="font-semibold mb-3">Pozisyon</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Miktar ({editedConfig.amountType === 'fixed' ? '$' : '%'})</Label><Input type="number" value={editedConfig.amount} onChange={(e) => handleConfigChange('amount', parseFloat(e.target.value))} className="bg-slate-800 border-slate-700"/></div>
                                                    <div className="space-y-2"><Label>Kaldıraç</Label><Input type="number" value={editedConfig.leverage} onChange={(e) => handleConfigChange('leverage', parseInt(e.target.value, 10))} className="bg-slate-800 border-slate-700"/></div>
                                                </div>
                                            </div>
                                            <Button onClick={handleUpdateConfig} className="w-full">Ayarları Güncelle</Button>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground">Bu bot için konfigürasyon verisi bulunamadı.</p>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </>
                    )}
                </SheetContent>
            </Sheet>

        </div>
    );
}
