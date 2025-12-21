'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  MarkerType,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  ReferenceLine,
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';


import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from '@/components/ui/slider';
import { Loader2, Rss, GitBranch, CircleDollarSign, Save, Play, Settings, X as XIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { IndicatorNode } from '@/components/editor/nodes/IndicatorNode';
import { LogicNode } from '@/components/editor/nodes/LogicNode';
import { ActionNode } from '@/components/editor/nodes/ActionNode';
import type { Bot, BotConfig } from '@/lib/types';
import type { TooltipProps } from 'recharts';


const initialNodes: Node[] = [
  {
    id: '1',
    type: 'indicator',
    position: { x: 50, y: 150 },
    data: { label: 'RSI İndikatörü', indicatorType: 'rsi', period: 14 }
  },
  {
    id: '2',
    type: 'logic',
    position: { x: 350, y: 150 },
    data: { label: 'Koşul', operator: 'lt', value: 30 }
  },
  {
    id: '3',
    type: 'action',
    position: { x: 650, y: 150 },
    data: { label: 'Alış Emri', actionType: 'buy', amount: 100 }
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id:e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
];

const nodeTypes = {
  indicator: IndicatorNode,
  logic: LogicNode,
  action: ActionNode,
};

// --- START: Mock Data Generation for Advanced Backtest ---

// Generate more realistic OHLC data
const generateMockOHLCData = () => {
    let price = 65000;
    const data = [];
    for (let i = 0; i < 60; i++) {
        const open = price * (1 + (Math.random() - 0.5) * 0.01);
        const high = Math.max(open, price) * (1 + Math.random() * 0.015);
        const low = Math.min(open, price) * (1 - Math.random() * 0.015);
        const close = low + Math.random() * (high - low);
        price = close;
        data.push({
            time: `D${i+1}`,
            ohlc: [open, high, low, close],
            rsi: 30 + Math.random() * 40,
        });
    }
    return data;
};

const mockBacktestData = generateMockOHLCData();

// Simulate some trades based on the OHLC data
const mockTradeData = [
    { time: 'D10', type: 'buy', price: mockBacktestData[9].ohlc[3], rsi: mockBacktestData[9].rsi },
    { time: 'D18', type: 'sell', price: mockBacktestData[17].ohlc[3], rsi: mockBacktestData[17].rsi },
    { time: 'D25', type: 'buy', price: mockBacktestData[24].ohlc[3], rsi: mockBacktestData[24].rsi },
    { time: 'D35', type: 'sell', price: mockBacktestData[34].ohlc[3], rsi: mockBacktestData[34].rsi },
    { time: 'D48', type: 'buy', price: mockBacktestData[47].ohlc[3], rsi: mockBacktestData[47].rsi },
    { time: 'D55', type: 'sell', price: mockBacktestData[54].ohlc[3], rsi: mockBacktestData[54].rsi },
].map(trade => {
    const dataPoint = mockBacktestData.find(d => d.time === trade.time);
    return {
        ...trade,
        // Position markers above/below the candle
        position: trade.type === 'buy' ? dataPoint!.ohlc[2] * 0.995 : dataPoint!.ohlc[1] * 1.005
    };
});

const initialStrategyConfig: BotConfig = {
    stopLoss: 2.0,
    takeProfit: 5.0,
    trailingStop: false,
    amountType: 'fixed',
    amount: 100,
    leverage: 1
};


// Custom Shape for Scatter Markers
const TradeMarker = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload.type === 'buy') {
        return <ArrowUp x={cx - 8} y={cy - 8} width={16} height={16} className="text-green-500 fill-current" />;
    }
    if (payload.type === 'sell') {
        return <ArrowDown x={cx - 8} y={cy - 8} width={16} height={16} className="text-red-500 fill-current" />;
    }
    return null;
};

// Custom Tooltip for combined chart
const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (active && payload && payload.length) {
        const ohlc = payload.find(p => p.dataKey === 'ohlc')?.payload.ohlc;
        const rsi = payload.find(p => p.dataKey === 'rsi')?.payload.rsi;
        const trade = payload.find(p => p.dataKey === 'position');

        return (
            <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-md text-white text-xs backdrop-blur-sm">
                <p className="font-bold">{`Tarih: ${label}`}</p>
                {ohlc && (
                    <>
                        <p>Açılış: <span className="font-mono">${ohlc[0].toFixed(2)}</span></p>
                        <p>Yüksek: <span className="font-mono">${ohlc[1].toFixed(2)}</span></p>
                        <p>Düşük: <span className="font-mono">${ohlc[2].toFixed(2)}</span></p>
                        <p>Kapanış: <span className="font-mono">${ohlc[3].toFixed(2)}</span></p>
                    </>
                )}
                {rsi && <p>RSI: <span className="font-mono">{rsi.toFixed(2)}</span></p>}
                {trade && (
                     <p className={`font-bold mt-2 ${trade.payload.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.payload.type.toUpperCase()} @ ${trade.payload.price.toFixed(2)}
                    </p>
                )}
            </div>
        );
    }
    return null;
};
// --- END: Mock Data Generation ---


export default function StrategyEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [strategyConfig, setStrategyConfig] = useState<BotConfig>(initialStrategyConfig);

  const { toast } = useToast();
  const router = useRouter();

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const addNode = useCallback((type: string) => {
    const newNodeId = `${type}-${Date.now()}`;
    let nodeLabel = "Yeni Düğüm";
    let nodeData = {};
    
    const position = {
        x: 250 + Math.random() * 150,
        y: 100 + Math.random() * 150,
    };

    if (type === 'indicator') {
      nodeLabel = 'Yeni İndikatör';
      nodeData = { label: nodeLabel, indicatorType: 'rsi', period: 14 };
    } else if (type === 'logic') {
      nodeLabel = 'Yeni Koşul';
      nodeData = { label: nodeLabel, operator: 'lt', value: 30 };
    } else if (type === 'action') {
      nodeLabel = 'Yeni İşlem';
      nodeData = { label: nodeLabel, actionType: 'buy', amount: 100 };
    }

    const newNode: Node = {
      id: newNodeId,
      type,
      position,
      data: nodeData,
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);


  const handleRunStrategy = async () => {
    setIsCompiling(true);
    toast({
        title: 'Strateji Test Ediliyor...',
        description: 'Lütfen bekleyin.',
    });

    try {
      const response = await fetch('/api/run-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Bilinmeyen bir test hatası oluştu.');
      }
      
      toast({
        title: 'Test Başarılı',
        description: data.message,
        variant: 'default',
      });

    } catch (error) {
       const errorMessage = (error as Error).message;
       toast({
         title: 'Test Hatası',
         description: errorMessage,
         variant: 'destructive',
       });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSaveStrategy = () => {
    const botName = window.prompt("Yeni botunuz için bir isim girin:");

    if (botName && botName.trim() !== '') {
      try {
        const newBot: Bot = {
          id: Date.now(),
          name: botName,
          pair: 'BTC/USDT',
          status: 'Durduruldu',
          pnl: 0,
          duration: "0s",
          config: strategyConfig
        };

        const storedBotsJSON = localStorage.getItem('myBots');
        const bots: Bot[] = storedBotsJSON ? JSON.parse(storedBotsJSON) : [];
        bots.push(newBot);
        localStorage.setItem('myBots', JSON.stringify(bots));

        toast({
          title: 'Strateji Kaydedildi!',
          description: `"${botName}" adlı yeni bot oluşturuldu.`,
        });

        router.push('/bot-status');
      } catch (error) {
        toast({
          title: 'Kayıt Hatası',
          description: 'Bot kaydedilirken bir hata oluştu.',
          variant: 'destructive',
        });
        console.error("Bot kaydetme hatası:", error);
      }
    } else if (botName !== null) {
        window.alert('İsim girmediniz, işlem iptal edildi.');
    }
  };
  
  const handleBacktest = () => {
    setIsBacktesting(true);
    setTimeout(() => {
        setIsBacktesting(false);
        setIsBacktestModalOpen(true);
    }, 1500);
  }

  const handleConfigChange = (field: keyof BotConfig, value: any) => {
    setStrategyConfig(prev => ({...prev, [field]: value}));
  }

  return (
    <div className="flex h-full w-full flex-row overflow-hidden">
        <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 p-4 flex flex-col gap-2">
            <h3 className="font-bold text-lg text-foreground mb-4 font-headline">Araç Kutusu</h3>
             <Button variant="outline" className="justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-white border-slate-700" onClick={() => addNode('indicator')}>
                <Rss className="text-blue-500" /> İndikatör Ekle
            </Button>
            <Button variant="outline" className="justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-white border-slate-700" onClick={() => addNode('logic')}>
                <GitBranch className="text-purple-500" /> Mantık Ekle
            </Button>
            <Button variant="outline" className="justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-white border-slate-700" onClick={() => addNode('action')}>
                <CircleDollarSign className="text-green-500" /> İşlem Ekle
            </Button>
        </aside>

        <main className="flex-1 relative h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                className="bg-background"
            >
                <Background color="#334155" gap={20} size={1} />
                <Controls />
            </ReactFlow>

            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <Button onClick={handleRunStrategy} disabled={isCompiling || isBacktesting}>
                    {isCompiling ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Çalıştırılıyor...</>
                    ) : (
                        "Stratejiyi Test Et"
                    )}
                </Button>
                 <Button onClick={handleBacktest} disabled={isCompiling || isBacktesting} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                    {isBacktesting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Hesaplanıyor...</>
                    ) : (
                       <><Play className="mr-2 h-4 w-4" /> Backtest Başlat</>
                    )}
                </Button>
                <Button variant="secondary" className="bg-slate-600 hover:bg-slate-500" onClick={() => setIsSettingsModalOpen(true)} disabled={isCompiling || isBacktesting}>
                    <Settings className="mr-2 h-4 w-4" />
                    Strateji Ayarları
                </Button>
                <Button variant="secondary" onClick={handleSaveStrategy} disabled={isCompiling || isBacktesting}>
                    <Save className="mr-2 h-4 w-4" />
                    Kaydet
                </Button>
            </div>
        </main>
        
        {isBacktestModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="w-[90vw] h-[85vh] flex flex-col rounded-xl border border-slate-800 bg-slate-900/95 text-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 p-4 shrink-0">
                        <h2 className="text-xl font-headline font-semibold">Strateji Performans Raporu</h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsBacktestModalOpen(false)}>
                            <XIcon className="h-5 w-5"/>
                        </Button>
                    </div>
                    <div className="p-4 md:p-6 flex-1 min-h-0 grid grid-rows-[auto,1fr] gap-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Net Kâr</p>
                                <p className="text-lg font-bold text-green-400">+$1,240.50 <span className="text-sm font-medium text-slate-300">(%12.4)</span></p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Maks. Düşüş</p>
                                <p className="text-lg font-bold text-red-400">-5.2%</p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Kâr Faktörü</p>
                                <p className="text-lg font-bold">2.18</p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Toplam İşlem</p>
                                <p className="text-lg font-bold">6</p>
                            </div>
                        </div>

                        <div className="w-full h-full">
                           <ResponsiveContainer width="100%" height="75%">
                               <ComposedChart data={mockBacktestData} syncId="backtestChart">
                                    <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3"/>
                                    <XAxis dataKey="time" tick={{fontSize: 12}} stroke="rgba(255,255,255,0.4)" />
                                    <YAxis 
                                        yAxisId="price" 
                                        orientation="right"
                                        domain={['dataMin * 0.98', 'dataMax * 1.02']} 
                                        tickFormatter={(val: number) => `$${(val/1000).toFixed(1)}k`}
                                        tick={{fontSize: 12}}
                                        stroke="rgba(255,255,255,0.4)"
                                    />
                                    <YAxis yAxisId="rsi" orientation="right" domain={[0, 100]} tickCount={5} axisLine={false} tickLine={false} tick={{fontSize: 10}} hide={true} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    
                                    <Line yAxisId="price" type="monotone" dataKey={(v) => v.ohlc ? v.ohlc[3] : null} name="Fiyat" stroke="#82ca9d" dot={false} />
                                    
                                    <Scatter yAxisId="price" name="İşlemler" data={mockTradeData} dataKey="position" shape={<TradeMarker />} />
                               </ComposedChart>
                            </ResponsiveContainer>
                            <ResponsiveContainer width="100%" height="25%">
                                <ComposedChart data={mockBacktestData} syncId="backtestChart" margin={{left: 0, right: 10, top: 20}}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3"/>
                                    <XAxis dataKey="time" hide={true}/>
                                    <YAxis yAxisId="rsi" orientation="right" domain={[0, 100]} tickCount={3} tick={{fontSize: 12}} stroke="rgba(255,255,255,0.4)" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <ReferenceLine yAxisId="rsi" y={70} label={{value: "70", position: 'insideRight', fill: 'rgba(255,255,255,0.5)', fontSize: 10}} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                    <ReferenceLine yAxisId="rsi" y={30} label={{value: "30", position: 'insideRight', fill: 'rgba(255,255,255,0.5)', fontSize: 10}} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                    <Area yAxisId="rsi" type="monotone" dataKey="rsi" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} name="RSI"/>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isSettingsModalOpen && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900/95 text-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 p-4">
                        <h2 className="text-xl font-headline font-semibold">Strateji Konfigürasyonu</h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsSettingsModalOpen(false)}>
                            <XIcon className="h-5 w-5"/>
                        </Button>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Risk Yönetimi */}
                        <div>
                            <h3 className="text-lg font-semibold font-headline mb-4">Risk Yönetimi</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                                    <Input id="stop-loss" type="number" value={strategyConfig.stopLoss} onChange={e => handleConfigChange('stopLoss', parseFloat(e.target.value))} className="bg-slate-800 border-slate-700"/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="take-profit">Take Profit (%)</Label>
                                    <Input id="take-profit" type="number" value={strategyConfig.takeProfit} onChange={e => handleConfigChange('takeProfit', parseFloat(e.target.value))} className="bg-slate-800 border-slate-700"/>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 mt-4">
                                <Checkbox id="trailing-stop" checked={strategyConfig.trailingStop} onCheckedChange={checked => handleConfigChange('trailingStop', !!checked)} />
                                <Label htmlFor="trailing-stop">Trailing Stop Kullan</Label>
                            </div>
                        </div>
                        
                        {/* Pozisyon Boyutlandırma */}
                        <div>
                            <h3 className="text-lg font-semibold font-headline mb-4">Pozisyon Boyutlandırma</h3>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                    <Label htmlFor="amount-type">İşlem Tutarı Tipi</Label>
                                    <Select value={strategyConfig.amountType} onValueChange={value => handleConfigChange('amountType', value)}>
                                        <SelectTrigger id="amount-type" className="bg-slate-800 border-slate-700">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-white">
                                            <SelectItem value="fixed">Sabit ($)</SelectItem>
                                            <SelectItem value="percentage">Yüzde (%)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="amount">Miktar</Label>
                                    <Input id="amount" type="number" value={strategyConfig.amount} onChange={e => handleConfigChange('amount', parseFloat(e.target.value))} className="bg-slate-800 border-slate-700"/>
                                </div>
                            </div>
                            <div className="space-y-3 mt-4">
                                <div className="flex justify-between">
                                   <Label htmlFor="leverage">Kaldıraç (Leverage)</Label>
                                   <span className="text-sm font-mono px-2 py-1 rounded bg-slate-700">{strategyConfig.leverage}x</span>
                                </div>
                                <Slider 
                                    id="leverage" 
                                    min={1} 
                                    max={20} 
                                    step={1} 
                                    value={[strategyConfig.leverage]} 
                                    onValueChange={([value]) => handleConfigChange('leverage', value)}
                                />
                            </div>
                        </div>

                    </div>
                     <div className="flex justify-end gap-2 border-t border-slate-800 p-4">
                        <Button onClick={() => setIsSettingsModalOpen(false)} variant="secondary">İptal</Button>
                        <Button onClick={() => {
                            toast({title: "Ayarlar Kaydedildi!"});
                            setIsSettingsModalOpen(false)
                        }}>Ayarları Kaydet</Button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
}

    