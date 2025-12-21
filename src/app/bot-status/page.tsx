'use client';

import { useState } from "react";
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Terminal, Bot, Settings, PlusCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const initialBots = [
    { id: 1, name: "BTC-RSI Stratejisi", pair: "BTC/USDT", status: "Çalışıyor", pnl: 12.5, duration: "2g 5sa" },
    { id: 2, name: "ETH-MACD Scalp", pair: "ETH/USDT", status: "Durduruldu", pnl: -3.2, duration: "12sa 15dk" },
    { id: 3, name: "SOL-Trend Follow", pair: "SOL/USDT", status: "Çalışıyor", pnl: 8.9, duration: "5g 1sa" },
    { id: 4, name: "AVAX Arbitraj", pair: "AVAX/USDT", status: "Hata", pnl: 0, duration: "1sa" },
];

const initialLogs = [
    { type: 'info', message: '[10:00:00] "BTC-RSI Stratejisi" botu başlatıldı.' },
    { type: 'trade', message: '[10:05:12] 0.1 BTC @ 68123.45 USDT ALINDI.' },
    { type: 'trade', message: '[10:15:30] 0.1 BTC @ 68456.78 USDT SATILDI. K&Z: +$33.33' },
    { type: 'warning', message: "[10:18:00] Binance'de ETH/USDT çifti için yüksek kayma tespit edildi." },
    { type: 'error', message: '[10:20:00] "AVAX Arbitraj" botu Kraken API\'sine bağlanamadı.' },
    { type: 'info', message: '[10:22:00] "ETH-MACD Scalp" botu kullanıcı tarafından duraklatıldı.' },
];

const logTypeConfig = {
    info: "text-foreground",
    trade: "text-accent",
    warning: "text-muted-foreground",
    error: "text-destructive",
};

const statusConfig = {
    "Çalışıyor": {
        badge: "default",
        dot: "bg-green-500 animate-pulse",
        icon: <Pause className="h-4 w-4" />,
        action: "Durdur"
    },
    "Durduruldu": {
        badge: "secondary",
        dot: "bg-gray-500",
        icon: <Play className="h-4 w-4" />,
        action: "Başlat"
    },
    "Hata": {
        badge: "destructive",
        dot: "bg-red-500",
        icon: <Play className="h-4 w-4" />,
        action: "Tekrar Dene"
    }
};

export default function BotStatusPage() {
    const [bots, setBots] = useState(initialBots);
    const [logs, setLogs] = useState(initialLogs);

    const addLog = (type: keyof typeof logTypeConfig, message: string) => {
        const timestamp = new Date().toLocaleTimeString('tr-TR', { hour12: false });
        setLogs(prevLogs => [{ type, message: `[${timestamp}] ${message}` }, ...prevLogs]);
    }

    const handleToggleStatus = (botId: number) => {
        setBots(bots.map(bot => {
            if (bot.id === botId) {
                if (bot.status === "Çalışıyor") {
                    addLog('info', `"${bot.name}" botu kullanıcı tarafından durduruldu.`);
                    return { ...bot, status: "Durduruldu" };
                }
                addLog('info', `"${bot.name}" botu kullanıcı tarafından başlatıldı.`);
                return { ...bot, status: "Çalışıyor" };
            }
            return bot;
        }));
    };

    const handleDeleteBot = (botId: number) => {
        const botToDelete = bots.find(bot => bot.id === botId);
        if (botToDelete && window.confirm(`"${botToDelete.name}" adlı botu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
            setBots(bots.filter(bot => bot.id !== botId));
            addLog('warning', `"${botToDelete.name}" botu kalıcı olarak silindi.`);
        }
    };

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
                    const config = statusConfig[bot.status as keyof typeof statusConfig];
                    return (
                        <Card key={bot.id} className="flex flex-col border-l-4 border-transparent data-[status=Çalışıyor]:border-primary data-[status=Hata]:border-destructive" data-status={bot.status}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="font-headline text-xl flex items-center gap-2">
                                            <Bot className="h-5 w-5 text-primary"/> {bot.name}
                                        </CardTitle>
                                        <CardDescription className="pt-2 flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", config.dot)}></div>
                                            <Badge variant={config.badge as any}>{bot.status}</Badge>
                                            <span className="text-muted-foreground font-mono text-xs">{bot.pair}</span>
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(bot.id)} aria-label={config.action}>
                                            {config.icon}
                                        </Button>
                                         <Button variant="ghost" size="icon" disabled>
                                            <Settings className="h-4 w-4"/>
                                        </Button>
                                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteBot(bot.id)} aria-label="Sil">
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
                            <p key={index}><span className={cn(logTypeConfig[log.type as keyof typeof logTypeConfig])}>[{log.type.toUpperCase()}]</span> {log.message}</p>
                        ))}
                       </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
