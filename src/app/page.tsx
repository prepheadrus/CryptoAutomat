"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bot, Percent, DollarSign } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
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

// Helper function to generate simulated performance data based on bot PNL
const generatePerformanceData = (bots: BotType[], initialValue: number) => {
    const data = [];
    const totalPnlContribution = bots.reduce((acc, bot) => acc + (bot.pnl / 100 * (bot.config.initialBalance || 1000)), 0);
    const currentValue = initialValue + totalPnlContribution;
    
    let value = currentValue * (1 - (totalPnlContribution / currentValue / 7)); // Start from a point 7 days ago

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        data.push({
            name: date.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
            value: value,
        });
        // Simulate a path towards the current value
        value += (totalPnlContribution / 7) + (Math.random() - 0.5) * (currentValue * 0.01);
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
    const averagePnl = bots.length > 0 ? totalPnl / bots.length : 0;
    
    // Assume each bot contributes to a central portfolio
    const initialPortfolioValue = 10000.00;
    const portfolioValue = initialPortfolioValue + bots.reduce((acc, bot) => acc + ((bot.config.currentBalance || bot.config.initialBalance || 0) - (bot.config.initialBalance || 0)), 0);
    
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
    
    const chartConfig = {
      value: {
        label: "Value",
      },
      ...pieChartData.reduce((acc, { name }) => {
        acc[name] = { label: name };
        return acc;
      }, {} as any)
    };


    const performanceData = isClient ? generatePerformanceData(bots, initialPortfolioValue) : [];
    const recentBots = [...bots].sort((a, b) => b.id - a.id).slice(0, 5);


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
            <CardTitle className="text-sm font-medium">Portföy Değeri</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">${portfolioValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <p className="text-xs text-muted-foreground">Tüm botların toplam sanal değeri</p>
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
            <CardTitle className="text-sm font-medium">Ortalama Kâr/Zarar</CardTitle>
             <div className={`text-2xl font-bold ${averagePnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {averagePnl >= 0 ? '+' : ''}{averagePnl.toFixed(2)}%
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Bot başına ortalama performans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kazanma Oranı</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{winningBots} / {bots.length} kârlı bot</p>
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
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <PieChart>
                         <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        <Pie
                            data={pieChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
                                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                                const name = pieChartData[pieChartData.findIndex(d => d.value === (percent * 100))]?.name;
                                return (
                                <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                                    {`${pieChartData.find(d => d.name === name)?.name} (${(percent * 100).toFixed(0)}%)`}
                                </text>
                                );
                            }}
                        >
                            {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
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
