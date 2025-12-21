"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, LineChart, Activity, DollarSign, Bot, Percent } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Bot as BotType } from "@/lib/types";

// Helper function to generate simulated performance data
const generatePerformanceData = (currentValue: number) => {
    const data = [];
    let value = currentValue * (1 - (Math.random() * 0.1 - 0.05)); // Start from a slightly different point
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            name: date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
            value: value,
        });
        value *= (1 + (Math.random() * 0.02 - 0.008)); // Simulate daily fluctuation
    }
    data[data.length - 1].value = currentValue; // Ensure the last point is the current value
    return data;
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardPage() {
    const [bots, setBots] = useState<BotType[]>([]);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        try {
            const storedBots = localStorage.getItem('myBots');
            if (storedBots) {
                setBots(JSON.parse(storedBots));
            }
        } catch (error) {
            console.error("Botlar localStorage'dan yüklenirken hata:", error);
        }
    }, []);

    // --- KPI Calculations ---
    const activeBots = bots.filter(bot => bot.status === "Çalışıyor").length;
    const totalPnl = bots.reduce((acc, bot) => acc + bot.pnl, 0);
    const initialPortfolioValue = 125789.00;
    // Assuming PNL is a percentage of an initial trade value, let's simplify for now
    // and just add the PNL value as a dollar amount for demonstration.
    const portfolioValue = initialPortfolioValue + bots.reduce((acc, bot) => acc + (bot.pnl/100 * 1000),0) ; // Simplified calculation
    
    const winningBots = bots.filter(bot => bot.pnl > 0).length;
    const winRate = bots.length > 0 ? (winningBots / bots.length) * 100 : 0;
    
    // --- Chart Data Calculations ---
    const assetDistribution = bots.reduce((acc, bot) => {
        const asset = bot.pair.split('/')[0];
        acc[asset] = (acc[asset] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const pieChartData = Object.entries(assetDistribution).map(([name, value]) => ({
        name,
        value,
    }));

    const performanceData = isClient ? generatePerformanceData(portfolioValue) : [];
    const recentBots = [...bots].reverse().slice(0, 5);


  if (!isClient) {
    // Render a loading state or skeleton on the server
    return <div className="space-y-6">
        <h1 className="text-3xl font-headline font-bold">Yönetim Paneli</h1>
        <p>Yükleniyor...</p>
    </div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">Yönetim Paneli</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Kâr/Zarar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">Tüm botlardan gelen toplam</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Botlar</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBots}</div>
            <p className="text-xs text-muted-foreground">{bots.length} bot içinden</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portföy Değeri</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${portfolioValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground">Simüle edilmiş bakiye</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kazanma Oranı</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{winningBots} / {bots.length} kazanan bot</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="font-headline">Portföy Performansı</CardTitle>
             <CardDescription>Son 7 günlük simüle edilmiş genel bakış</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <AreaChart data={performanceData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} fontSize={12} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                <ChartTooltip
                  cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <defs>
                    <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#fillValue)" dot={false} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline">Varlık Dağılımı</CardTitle>
            <CardDescription>Botların çalıştığı varlıklara göre dağılım</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
             {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                                return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central">
                                    {`${(percent * 100).toFixed(0)}%`}
                                </text>
                                );
                            }}
                        >
                            {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Legend />
                        <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                    <BarChart className="h-10 w-10 mb-2"/>
                    <p>Varlık verisi bulunamadı.</p>
                    <p className="text-xs">Bot oluşturduğunuzda burada görünecektir.</p>
                </div>
             )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Son Aktiviteler (Eklenen Botlar)</CardTitle>
          <CardDescription>Sisteme en son eklenen botlar ve durumları.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bot Adı</TableHead>
                <TableHead>Parite</TableHead>
                <TableHead>PNL (%)</TableHead>
                <TableHead className="text-right">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentBots.length > 0 ? recentBots.map((bot) => (
                <TableRow key={bot.id}>
                  <TableCell className="font-medium">{bot.name}</TableCell>
                  <TableCell>{bot.pair}</TableCell>
                   <TableCell className={bot.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {bot.pnl.toFixed(2)}%
                   </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={
                      bot.status === 'Çalışıyor' ? 'default' : 
                      bot.status === 'Durduruldu' ? 'secondary' : 'destructive'
                    }>
                      {bot.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                        Henüz bot oluşturulmadı.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
