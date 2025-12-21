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
import { RSI as RSICalculator } from 'technicalindicators';

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
  { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
];

const nodeTypes = {
  indicator: IndicatorNode,
  logic: LogicNode,
  action: ActionNode,
};

type BacktestResult = {
  ohlcData: any[];
  tradeData: any[];
  pnlData: any[];
  stats: {
    netProfit: number;
    totalTrades: number;
    winRate: number;
    maxDrawdown: number;
    profitFactor: number;
  };
};

// --- START: Mock Data & Backtest Engine ---

const generateMockOHLCData = (numCandles = 100) => {
    let price = 65000 + Math.random() * 5000;
    const data = [];
    for (let i = 0; i < numCandles; i++) {
        const open = price;
        const high = open * (1 + Math.random() * 0.02);
        const low = open * (1 - Math.random() * 0.02);
        const close = low + Math.random() * (high - low);
        price = close;
        data.push({
            time: `D${i+1}`,
            date: new Date(2024, 0, i + 1), // Add date object for better axis
            price: close,
            ohlc: [open, high, low, close]
        });
    }
    return data;
};

// The core backtesting engine
const runBacktestEngine = (nodes: Node[], edges: Edge[]): BacktestResult => {
    // 1. Parse Strategy from nodes
    const indicatorNode = nodes.find(n => n.type === 'indicator');
    const logicNode = nodes.find(n => n.type === 'logic');
    
    // Default strategy if parsing fails
    const strategy = {
      indicator: indicatorNode?.data.indicatorType || 'rsi',
      period: indicatorNode?.data.period || 14,
      buyConditionOp: logicNode?.data.operator || 'lt',
      buyConditionVal: logicNode?.data.value || 30,
      sellConditionOp: 'gt', // Hardcoded exit strategy
      sellConditionVal: 70,  // Hardcoded exit strategy
    }
    
    // 2. Generate data and calculate indicators
    const ohlcData = generateMockOHLCData(100);
    const closePrices = ohlcData.map(d => d.price);
    let indicatorValues: (number | undefined)[] = [];

    if(strategy.indicator === 'rsi') {
      const rsiOutput = RSICalculator.calculate({ values: closePrices, period: strategy.period });
      // Pad beginning with undefined to match length
      indicatorValues = Array(strategy.period - 1).fill(undefined).concat(rsiOutput);
    }
    // (Future: Add SMA, EMA etc. here with else if)

    const chartData = ohlcData.map((d, i) => ({...d, rsi: indicatorValues[i]}));

    // 3. Simulate Trades
    let inPosition = false;
    let entryPrice = 0;
    let portfolioValue = 10000;
    const pnlData = [{ time: 'D0', pnl: portfolioValue }];
    const trades = [];
    let peakPortfolio = portfolioValue;
    let maxDrawdown = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    for (let i = 1; i < chartData.length; i++) {
        const rsi = chartData[i].rsi;
        if (!rsi) {
            pnlData.push({ time: chartData[i].time, pnl: portfolioValue });
            continue;
        };

        const buyCondition = strategy.buyConditionOp === 'lt' ? rsi < strategy.buyConditionVal : rsi > strategy.buyConditionVal;
        const sellCondition = strategy.sellConditionOp === 'gt' ? rsi > strategy.sellConditionVal : rsi < strategy.sellConditionVal;

        if (buyCondition && !inPosition) {
            // BUY
            inPosition = true;
            entryPrice = chartData[i].price;
            trades.push({ time: chartData[i].time, type: 'buy', price: entryPrice });
        } else if (sellCondition && inPosition) {
            // SELL
            const exitPrice = chartData[i].price;
            const profit = exitPrice - entryPrice;
            if (profit > 0) {
              totalProfit += profit;
              winningTrades++;
            } else {
              totalLoss += Math.abs(profit);
              losingTrades++;
            }
            portfolioValue += profit;
            inPosition = false;
            trades.push({ time: chartData[i].time, type: 'sell', price: exitPrice });
        }

        pnlData.push({ time: chartData[i].time, pnl: portfolioValue });

        // Calculate drawdown
        if (portfolioValue > peakPortfolio) {
            peakPortfolio = portfolioValue;
        }
        const drawdown = (peakPortfolio - portfolioValue) / peakPortfolio;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    const totalTrades = trades.length / 2;
    const stats = {
      netProfit: (portfolioValue - 10000) / 10000 * 100,
      totalTrades: totalTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      maxDrawdown: maxDrawdown * 100,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
    }

    return { ohlcData: chartData, tradeData: trades, pnlData, stats };
};

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
    if (!payload.type) return null;
    const isBuy = payload.type === 'buy';
    const markerY = isBuy ? cy + 10 : cy - 10;
    
    if (isBuy) {
        return <ArrowUp x={cx - 8} y={markerY} width={16} height={16} className="text-green-500 fill-current" />;
    }
    return <ArrowDown x={cx - 8} y={markerY} width={16} height={16} className="text-red-500 fill-current" />;
};

// Custom Tooltip for combined chart
const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (active && payload && payload.length) {
        const priceData = payload.find(p => p.dataKey === 'price')?.payload;
        const pnlData = payload.find(p => p.dataKey === 'pnl');
        
        // Find trade by looking into the full payload, not a separate mock array
        const trade = payload.find(p => p.dataKey === 'tradeMarker')?.payload;

        return (
            <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-md text-white text-xs backdrop-blur-sm">
                <p className="font-bold">{`Tarih: ${label}`}</p>
                {priceData && <p>Fiyat: <span className="font-mono">${priceData.price.toFixed(2)}</span></p>}
                {pnlData && <p>Kâr: <span className="font-mono">${pnlData.value?.toFixed(2)}</span></p>}
                {priceData && priceData.rsi && <p>RSI: <span className="font-mono">{priceData.rsi.toFixed(2)}</span></p>}
                {trade && trade.type && (
                     <p className={`font-bold mt-2 ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.type.toUpperCase()} @ ${trade.price?.toFixed(2)}
                    </p>
                )}
            </div>
        );
    }
    return null;
};
// --- END: Mock Data & Backtest Engine ---


export default function StrategyEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [strategyConfig, setStrategyConfig] = useState<BotConfig>(initialStrategyConfig);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);

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
        const result = runBacktestEngine(nodes, edges);
        setBacktestResult(result);
        setIsBacktesting(false);
        setIsBacktestModalOpen(true);
    }, 1500);
  }

  const handleConfigChange = (field: keyof BotConfig, value: any) => {
    setStrategyConfig(prev => ({...prev, [field]: value}));
  }

  const chartAndTradeData = useMemo(() => {
    if (!backtestResult) return [];
    
    return backtestResult.ohlcData.map(ohlc => {
      const trade = backtestResult.tradeData.find(t => t.time === ohlc.time);
      const pnl = backtestResult.pnlData.find(p => p.time === ohlc.time);
      return {
        ...ohlc,
        pnl: pnl?.pnl,
        tradeMarker: trade, // for scatter plot
      };
    });
  }, [backtestResult]);

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
        
        {isBacktestModalOpen && backtestResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="w-[90vw] h-[85vh] flex flex-col rounded-xl border border-slate-800 bg-slate-900/95 text-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 p-4 shrink-0">
                        <h2 className="text-xl font-headline font-semibold">Strateji Performans Raporu</h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsBacktestModalOpen(false)}>
                            <XIcon className="h-5 w-5"/>
                        </Button>
                    </div>
                    <div className="p-4 md:p-6 flex-1 min-h-0 grid grid-rows-[auto,1fr] gap-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Net Kâr</p>
                                <p className={`text-lg font-bold ${backtestResult.stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {backtestResult.stats.netProfit.toFixed(2)}%
                                </p>
                            </div>
                             <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Toplam İşlem</p>
                                <p className="text-lg font-bold">{backtestResult.stats.totalTrades}</p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Başarı Oranı</p>
                                <p className="text-lg font-bold">{backtestResult.stats.winRate.toFixed(1)}%</p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Maks. Düşüş</p>
                                <p className="text-lg font-bold text-red-400">-{backtestResult.stats.maxDrawdown.toFixed(2)}%</p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-3">
                                <p className="text-xs text-slate-400">Kâr Faktörü</p>
                                <p className="text-lg font-bold">{isFinite(backtestResult.stats.profitFactor) ? backtestResult.stats.profitFactor.toFixed(2) : "∞"}</p>
                            </div>
                        </div>

                        <div className="w-full h-full">
                           <ResponsiveContainer width="100%" height="70%">
                               <ComposedChart data={chartAndTradeData} syncId="backtestChart">
                                    <defs>
                                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3"/>
                                    <XAxis dataKey="time" tick={{fontSize: 12}} stroke="rgba(255,255,255,0.4)" />
                                    <YAxis 
                                        yAxisId="left" 
                                        orientation="left"
                                        domain={['auto', 'auto']} 
                                        tickFormatter={(val: number) => `$${val.toLocaleString()}`}
                                        tick={{fontSize: 12}}
                                        stroke="#8884d8"
                                    />
                                    <YAxis 
                                        yAxisId="right" 
                                        orientation="right"
                                        domain={['dataMin * 0.98', 'dataMax * 1.02']} 
                                        tickFormatter={(val: number) => `$${(val/1000).toFixed(1)}k`}
                                        tick={{fontSize: 12}}
                                        stroke="#82ca9d"
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    
                                    <Area yAxisId="left" type="monotone" dataKey="pnl" name="Kümülatif Kâr" stroke="#8884d8" fill="url(#colorPnl)" />
                                    
                                    <Line yAxisId="right" type="monotone" dataKey="price" name="Fiyat" stroke="#82ca9d" dot={false} />
                                    
                                    <Scatter yAxisId="right" name="İşlemler" dataKey="tradeMarker" shape={<TradeMarker />} />
                                </ComposedChart>
                            </ResponsiveContainer>
                            <ResponsiveContainer width="100%" height="30%">
                                <ComposedChart data={chartAndTradeData} syncId="backtestChart" margin={{left: 0, right: 10, top: 20}}>
                                    <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3"/>
                                    <XAxis dataKey="time" hide={true}/>
                                    <YAxis yAxisId="rsi" orientation="right" domain={[0, 100]} tickCount={3} tick={{fontSize: 12}} stroke="rgba(255,255,255,0.4)" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <ReferenceLine yAxisId="rsi" y={70} label={{value: "70", position: 'insideRight', fill: 'rgba(255,255,255,0.5)', fontSize: 10}} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                    <ReferenceLine yAxisId="rsi" y={30} label={{value: "30", position: 'insideRight', fill: 'rgba(255,255,255,0.5)', fontSize: 10}} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                    <Area yAxisId="rsi" type="monotone" dataKey="rsi" stroke="#eab308" fill="#eab308" fillOpacity={0.2} name="RSI"/>
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
