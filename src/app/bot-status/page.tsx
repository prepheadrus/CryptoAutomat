'use client';

import { useState, MouseEvent, useEffect, useMemo, useRef, useCallback } from "react";
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Terminal, Bot, Settings, PlusCircle, Trash2, Eye, X as XIcon, AreaChart as AreaChartIcon, Activity, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Bot as BotType, Log, BotStatus, BotConfig } from "@/lib/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const initialBots: BotType[] = [
    { id: 1, name: "BTC-RSI Stratejisi", pair: "BTC/USDT", status: "Çalışıyor", pnl: 12.5, duration: "2g 5sa", config: { mode: 'PAPER', stopLoss: 2, takeProfit: 5, trailingStop: false, amountType: 'fixed', amount: 100, leverage: 5, initialBalance: 10000, currentBalance: 11250, inPosition: true, entryPrice: 65000, positionSize: 0.1 } },
    { id: 2, name: "ETH-MACD Scalp", pair: "ETH/USDT", status: "Durduruldu", pnl: -3.2, duration: "12sa 15dk", config: { mode: 'LIVE', stopLoss: 1.5, takeProfit: 3, trailingStop: true, amountType: 'percentage', amount: 10, leverage: 10, initialBalance: 10000 } },
    { id: 3, name: "SOL-Trend Follow", pair: "SOL/USDT", status: "Çalışıyor", pnl: 8.9, duration: "5g 1sa", config: { mode: 'PAPER', stopLoss: 5, takeProfit: 10, trailingStop: false, amountType: 'fixed', amount: 250, leverage: 3, initialBalance: 10000, currentBalance: 10890, inPosition: false } },
    { id: 4, name: "AVAX Arbitraj", pair: "AVAX/USDT", status: "Hata", pnl: 0, duration: "1sa", config: { mode: 'LIVE', stopLoss: 3, takeProfit: 6, trailingStop: false, amountType: 'fixed', amount: 50, leverage: 1, initialBalance: 10000 } },
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
const generateBotPerformanceData = (bot: BotType) => {
    const data = [];
    const baseValue = bot.config.initialBalance || 10000;
    let currentValue = bot.config.currentBalance || baseValue;
    
    // Create a smooth-ish path to the current value over 30 days
    const a = (currentValue - baseValue) / (29 * 29); // Coefficient for a quadratic curve

    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Use a base curve + some noise
        const day = 29-i;
        const curveValue = baseValue + a * day * day;
        const noise = (Math.random() - 0.5) * baseValue * 0.01; // +/- 0.5% noise
        let finalValue = curveValue + noise;

        data.push({
            name: date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
            profit: finalValue,
        });
    }
    // Ensure the last point is accurate
    data[29].profit = currentValue;

    return data;
};


export default function BotStatusPage() {
    const [bots, setBots] = useState<BotType[]>([]);
    const [logs, setLogs] = useState<Log[]>(initialLogs);
    const [isClient, setIsClient] = useState(false);
    const [selectedBot, setSelectedBot] = useState<BotType | null>(null);
    const [editedConfig, setEditedConfig] = useState<BotConfig | undefined>(undefined);
    const [hasApiKeys, setHasApiKeys] = useState(false);
    const { toast } = useToast();
    const intervalRefs = useRef<Record<number, NodeJS.Timeout>>({});
    
    const addLog = useCallback((type: LogType, message: string) => {
        const timestamp = new Date().toLocaleTimeString('tr-TR', { hour12: false });
        setLogs(prevLogs => [{ type, message: `[${timestamp}] ${message}` }, ...prevLogs].slice(0, 100));
    }, []);

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
                    const newCurrentBalance = (config.currentBalance || 0) + profit;
                    newPnl = ((newCurrentBalance - (config.initialBalance || 10000)) / (config.initialBalance || 10000)) * 100;
                    logMessage = `[${b.name}] [PAPER] SATIŞ @ ${currentPrice.toFixed(2)}. K&Z: ${profit.toFixed(2)}$`;
                    addLog('trade', logMessage);
                    newConfig = { ...newConfig, inPosition: false, entryPrice: undefined, currentBalance: newCurrentBalance };
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

    const runLiveTradeSimulation = useCallback((bot: BotType) => {
        // This is a placeholder for actual live trade logic
        // In a real app, this would involve checking exchange for position status, PNL etc.
        addLog('info', `[${bot.name}] [LIVE] için periyodik durum kontrolü yapılıyor.`);
    }, [addLog]);


    useEffect(() => {
        setIsClient(true);
        try {
            const storedBots = localStorage.getItem('myBots');
            const storedKeys = localStorage.getItem('exchangeKeys');
            if(storedKeys) setHasApiKeys(true);

            let loadedBots: BotType[] = [];
            if (storedBots) {
                loadedBots = JSON.parse(storedBots);
            } else {
                loadedBots = initialBots;
            }

            const botsWithDefaults = loadedBots.map(bot => ({
                ...bot,
                config: {
                    mode: 'PAPER',
                    stopLoss: 2.0,
                    takeProfit: 5.0,
                    trailingStop: false,
                    amountType: 'fixed',
                    amount: 100,
                    leverage: 1,
                    initialBalance: 10000,
                    ...bot.config,
                }
            }));
            setBots(botsWithDefaults);

        } catch (error) {
            console.error("Botlar localStorage'dan yüklenirken hata:", error);
            toast({
                title: 'Veri Yükleme Hatası',
                description: 'Bot verileri yüklenirken bir sorun oluştu. Varsayılan veriler kullanılıyor.',
                variant: 'destructive',
            });
            setBots(initialBots);
        }

        return () => {
            Object.values(intervalRefs.current).forEach(clearInterval);
        };
    }, [toast]);

    // Effect to manage simulation intervals
    useEffect(() => {
        bots.forEach(bot => {
            const isRunning = bot.status === 'Çalışıyor';
            const intervalExists = intervalRefs.current[bot.id];

            if (isRunning && !intervalExists) {
                const callback = bot.config.mode === 'PAPER' ? runPaperTradeSimulation : runLiveTradeSimulation;
                intervalRefs.current[bot.id] = setInterval(() => {
                    // Pass the most recent version of the bot to the callback
                    setBots(currentBots => {
                        const currentBot = currentBots.find(b => b.id === bot.id);
                        if (currentBot) {
                           callback(currentBot);
                        }
                        return currentBots; // No state change in this setBots, just getting latest bot
                    });
                }, 5000 + Math.random() * 2000);
            } else if (!isRunning && intervalExists) {
                clearInterval(intervalRefs.current[bot.id]);
                delete intervalRefs.current[bot.id];
            }
        });
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bots.map(b => b.status + b.id).join(',')]); // Rerun only when status or bot list changes


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
        const botToToggle = bots.find(bot => bot.id === botId);
        if (!botToToggle) return;

        // Check for API keys if trying to start a LIVE bot
        if (botToToggle.config.mode === 'LIVE' && botToToggle.status !== 'Çalışıyor' && !hasApiKeys) {
            toast({
                variant: 'destructive',
                title: 'API Anahtarları Gerekli',
                description: 'Canlı (LIVE) bir botu başlatmak için lütfen Ayarlar sayfasından borsa API anahtarlarınızı ekleyin ve test edin.',
            });
            return;
        }

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
            // Ensure numeric fields are parsed correctly
            const numericFields: (keyof BotConfig)[] = ['stopLoss', 'takeProfit', 'amount', 'leverage'];
            if (numericFields.includes(field)) {
                 setEditedConfig(prev => ({...prev!, [field]: parseFloat(value) || 0}));
            } else {
                 setEditedConfig(prev => ({...prev!, [field]: value}));
            }
        }
    }

    const handleUpdateConfig = () => {
        if (!selectedBot || !editedConfig) return;

        if(selectedBot.config.mode !== editedConfig.mode && editedConfig.mode === 'LIVE' && !hasApiKeys) {
            toast({
                variant: 'destructive',
                title: 'API Anahtarları Eksik',
                description: 'Bot modunu CANLI olarak değiştirmek için önce Ayarlar sayfasından API anahtarlarınızı eklemelisiniz.'
            });
            // Revert mode change
            setEditedConfig(prev => ({...prev!, mode: 'PAPER'}));
            return;
        }

        setBots(prevBots => prevBots.map(bot => 
            bot.id === selectedBot.id ? { ...bot, config: editedConfig, status: 'Durduruldu' } : bot
        ));

        toast({
            title: "Ayarlar Güncellendi",
            description: `"${selectedBot.name}" botunun konfigürasyonu kaydedildi. Güvenlik için bot durduruldu.`,
        });

        setSelectedBot(null);
    }
    
    const botPerformanceData = useMemo(() => {
        if (!selectedBot) return [];
        return generateBotPerformanceData(selectedBot);
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
            
            {!hasApiKeys && isClient && (
                <Card className="border-l-4 border-yellow-500 bg-yellow-500/10">
                    <CardHeader className="flex flex-row items-center gap-4 py-4">
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                        <div>
                            <CardTitle className="text-yellow-200">API Anahtarları Eksik</CardTitle>
                            <CardDescription className="text-yellow-300/80">Canlı (LIVE) botları çalıştırmak için borsa API anahtarlarınızı eklemeniz gerekmektedir.</CardDescription>
                        </div>
                        <Button asChild variant="outline" className="ml-auto bg-transparent border-yellow-500 text-yellow-300 hover:bg-yellow-500/20 hover:text-yellow-200">
                           <Link href="/settings">Ayarlara Git</Link>
                        </Button>
                    </CardHeader>
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {bots.map((bot) => {
                    const config = statusConfig[bot.status];
                    return (
                        <Card key={bot.id} className="flex flex-col border-l-4 border-transparent data-[status=Çalışıyor]:border-primary data-[status=Hata]:border-destructive transition-all hover:shadow-lg" data-status={bot.status}>
                            <CardHeader className="pb-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="font-headline text-xl flex items-center gap-2">
                                            <Bot className="h-5 w-5 text-primary"/> {bot.name}
                                        </CardTitle>
                                        <CardDescription className="pt-2 flex items-center gap-2 flex-wrap">
                                            <div className={cn("w-2 h-2 rounded-full", config.dot)}></div>
                                            <Badge variant={config.badge}>{bot.status}</Badge>
                                            {bot.config.mode === 'PAPER' ? (
                                                <Badge variant="outline" className="border-amber-500 text-amber-500">PAPER</Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-green-500 text-green-500">LIVE</Badge>
                                            )}
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
                 {bots.length === 0 && isClient && (
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
                <SheetContent className="w-[400px] sm:w-[540px] bg-slate-900/95 border-slate-800 text-white p-0">
                    {selectedBot && (
                        <>
                            <SheetHeader className="p-6 border-b border-slate-800">
                                <div className="flex justify-between items-start">
                                    <SheetTitle className="font-headline text-2xl flex items-center gap-3">
                                        <Bot className="h-6 w-6 text-primary" /> {selectedBot.name}
                                    </SheetTitle>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedBot(null)}>
                                        <XIcon className="h-5 w-5"/>
                                    </Button>
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-4 pt-2">
                                     <span className="text-muted-foreground font-mono">{selectedBot.pair}</span>
                                     <Badge variant={statusConfig[selectedBot.status].badge}>{selectedBot.status}</Badge>
                                     {selectedBot.config.mode === 'PAPER' ? (
                                        <Badge variant="outline" className="border-amber-500 text-amber-500">PAPER</Badge>
                                     ) : (
                                         <Badge variant="outline" className="border-green-500 text-green-500">LIVE</Badge>
                                     )}
                                </div>
                            </SheetHeader>
                            <Tabs defaultValue="overview" className="w-full">
                                <TabsList className="grid w-full grid-cols-3 bg-slate-900/95 border-b border-slate-800 rounded-none px-6">
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
                                                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.5rem' }} />
                                                         <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                                        <Area type="monotone" dataKey="profit" stroke={selectedBot.pnl >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"} fill="url(#colorProfit)" strokeWidth={2} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Card className="bg-slate-800/50"><CardHeader><CardDescription>Toplam K&Z</CardDescription><CardTitle className={cn(selectedBot.pnl >= 0 ? "text-green-400" : "text-red-400")}>{selectedBot.pnl.toFixed(2)}%</CardTitle></CardHeader></Card>
                                            <Card className="bg-slate-800/50"><CardHeader><CardDescription>Çalışma Süresi</CardDescription><CardTitle>{selectedBot.duration}</CardTitle></CardHeader></Card>
                                            <Card className="bg-slate-800/50"><CardHeader><CardDescription>Bakiye</CardDescription><CardTitle>${(selectedBot.config.currentBalance || selectedBot.config.initialBalance)?.toLocaleString(undefined, {minimumFractionDigits: 2})}</CardTitle></CardHeader></Card>
                                            <Card className="bg-slate-800/50"><CardHeader><CardDescription>Pozisyon</CardDescription><CardTitle>{selectedBot.config.inPosition ? 'Açık' : 'Kapalı'}</CardTitle></CardHeader></Card>
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
                                                <h4 className="font-semibold mb-3">İşlem Modu</h4>
                                                <Select value={editedConfig.mode} onValueChange={(value: 'LIVE' | 'PAPER') => handleConfigChange('mode', value)} disabled={selectedBot.status === 'Çalışıyor'}>
                                                    <SelectTrigger className="bg-slate-800 border-slate-700"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="bg-slate-800 border-slate-600 text-white">
                                                        <SelectItem value="PAPER">Paper (Sanal Bakiye)</SelectItem>
                                                        <SelectItem value="LIVE">Live (Gerçek Bakiye)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                 {selectedBot.status === 'Çalışıyor' && <p className="text-xs text-muted-foreground mt-2">Bot çalışırken işlem modu değiştirilemez.</p>}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold mb-3">Risk Yönetimi</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Stop Loss (%)</Label><Input type="number" value={editedConfig.stopLoss} onChange={(e) => handleConfigChange('stopLoss', e.target.value)} className="bg-slate-800 border-slate-700"/></div>
                                                    <div className="space-y-2"><Label>Take Profit (%)</Label><Input type="number" value={editedConfig.takeProfit} onChange={(e) => handleConfigChange('takeProfit', e.target.value)} className="bg-slate-800 border-slate-700"/></div>
                                                </div>
                                            </div>
                                             <div>
                                                <h4 className="font-semibold mb-3">Pozisyon</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Miktar ({editedConfig.amountType === 'fixed' ? '$' : '%'})</Label><Input type="number" value={editedConfig.amount} onChange={(e) => handleConfigChange('amount', e.target.value)} className="bg-slate-800 border-slate-700"/></div>
                                                    <div className="space-y-2"><Label>Kaldıraç</Label><Input type="number" value={editedConfig.leverage} onChange={(e) => handleConfigChange('leverage', e.target.value)} className="bg-slate-800 border-slate-700"/></div>
                                                </div>
                                            </div>
                                            <Button onClick={handleUpdateConfig} className="w-full">Ayarları Kaydet</Button>
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
