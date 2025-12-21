
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { RSI as RSICalculator, MACD as MACDCalculator, SMA as SMACalculator } from 'technicalindicators';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from '@/components/ui/slider';
import { Loader2, Rss, GitBranch, CircleDollarSign, Save, Play, Settings, X as XIcon, ArrowUp, ArrowDown, Database, Zap } from 'lucide-react';
import { IndicatorNode } from '@/components/editor/nodes/IndicatorNode';
import { LogicNode } from '@/components/editor/nodes/LogicNode';
import { ActionNode } from '@/components/editor/nodes/ActionNode';
import { DataSourceNode } from '@/components/editor/nodes/DataSourceNode';
import type { Bot, BotConfig } from '@/lib/types';
import type { TooltipProps } from 'recharts';


const initialNodes: Node[] = [
   {
    id: 'd1',
    type: 'dataSource',
    position: { x: -250, y: 150 },
    data: { label: 'Veri Kaynağı', exchange: 'binance', symbol: 'BTC/USDT' }
  },
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
    data: { label: 'Alış Emri', actionType: 'buy' }
  },
];

const initialEdges: Edge[] = [
  { id: 'ed1-1', source: 'd1', target: '1', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
];

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

const initialStrategyConfig: BotConfig = {
    mode: 'PAPER',
    stopLoss: 2.0,
    takeProfit: 5.0,
    trailingStop: false,
    amountType: 'fixed',
    amount: 100,
    leverage: 1,
    initialBalance: 10000,
};

// --- START: Mock Data & Backtest Engine ---

const generateMockOHLCData = (numCandles = 200, symbol = 'BTC/USDT') => {
    let basePrice;
    if (symbol.includes('SOL')) basePrice = 150;
    else if (symbol.includes('ETH')) basePrice = 3500;
    else basePrice = 65000;

    let price = basePrice * (0.95 + Math.random() * 0.1);
    const data = [];
    for (let i = 0; i < numCandles; i++) {
        const open = price;
        const high = open * (1 + (Math.random() - 0.45) * 0.04); // Widen fluctuation
        const low = open * (1 - (Math.random() - 0.45) * 0.04);
        const close = low + Math.random() * (high - low);
        price = close;
        data.push({
            time: `D${i+1}`,
            date: new Date(2024, 0, i + 1),
            price: close,
            open,
            high,
            low,
            close,
        });
    }
    return data;
};


// The core backtesting engine
const runBacktestEngine = (nodes: Node[], edges: Edge[]): BacktestResult | { error: string } => {
    // 1. Find all data sources and generate their base data
    const dataSourceNodes = nodes.filter(n => n.type === 'dataSource');
    if (dataSourceNodes.length === 0) {
        return { error: 'Lütfen stratejinize en az bir "Veri Kaynağı" düğümü ekleyin.' };
    }

    const dataBySource: Record<string, any[]> = {};
    const pricesBySource: Record<string, number[]> = {};
    dataSourceNodes.forEach(node => {
        const symbol = node.data.symbol || 'BTC/USDT';
        const ohlcData = generateMockOHLCData(200, symbol);
        dataBySource[node.id] = ohlcData;
        pricesBySource[node.id] = ohlcData.map(d => d.price);
    });

    // 2. Calculate all indicators present on the graph
    const indicatorNodes = nodes.filter(n => n.type === 'indicator');
    const signals: Record<string, (number | undefined)[]> = {};

    indicatorNodes.forEach(node => {
        const sourceEdge = edges.find(e => e.target === node.id);
        if (!sourceEdge || !dataBySource[sourceEdge.source]) {
            // This indicator is not connected to a valid data source, skip it.
            console.warn(`İndikatör "${node.id}" geçerli bir veri kaynağına bağlı değil.`);
            signals[node.id] = [];
            return;
        }
        
        const closePrices = pricesBySource[sourceEdge.source];
        const { indicatorType, period } = node.data;
        let result: number[] = [];

        if (indicatorType === 'rsi') {
            result = RSICalculator.calculate({ values: closePrices, period: period || 14 });
        } else if (indicatorType === 'sma') {
            result = SMACalculator.calculate({ values: closePrices, period: period || 20 });
        } else if (indicatorType === 'ema') { // EMA is a type of MA
             result = SMACalculator.calculate({ values: closePrices, period: period || 20 });
        }
        // Future: Add MACD etc. here
        
        const padding = Array(closePrices.length - result.length).fill(undefined);
        signals[node.id] = padding.concat(result);
    });

    // Use the data from the first available data source for the main chart
    const mainDataSourceId = Object.keys(dataBySource)[0];
    const chartDataWithIndicators = dataBySource[mainDataSourceId].map((d, i) => {
        const enrichedData: any = { ...d };
        for (const nodeId in signals) {
            enrichedData[nodeId] = signals[nodeId][i];
        }
        return enrichedData;
    });

    // 3. Trading Simulation
    let inPosition = false;
    let portfolioValue = 10000;
    const pnlData = [{ time: 'D0', pnl: portfolioValue }];
    const trades = [];
    let peakPortfolio = portfolioValue;
    let maxDrawdown = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    const actionNodes = nodes.filter(n => n.type === 'action');

    const checkConditionsForAction = (candleIndex: number, actionNodeId: string): boolean => {
        const connectedLogicEdges = edges.filter(e => e.target === actionNodeId);
        if (connectedLogicEdges.length === 0) return false;

        // AND logic: all connected conditions must be true
        return connectedLogicEdges.every(edge => {
            const logicNode = nodes.find(n => n.id === edge.source);
            if (!logicNode || logicNode.type !== 'logic') return false;

            const connectedIndicatorEdges = edges.filter(e => e.target === logicNode.id);
            if (connectedIndicatorEdges.length === 0) return false;
            
            // For a logic node, check its condition
            return connectedIndicatorEdges.every(indEdge => {
                const indicatorNode = nodes.find(n => n.id === indEdge.source);
                if (!indicatorNode) return false;

                const indicatorValue = signals[indicatorNode.id]?.[candleIndex];
                if (indicatorValue === undefined) return false;

                const { operator, value: thresholdValue } = logicNode.data;
                
                switch (operator) {
                    case 'gt': return indicatorValue > thresholdValue;
                    case 'lt': return indicatorValue < thresholdValue;
                    // TODO: Implement crossover logic if needed
                    default: return false;
                }
            });
        });
    };

    for (let i = 1; i < chartDataWithIndicators.length; i++) {
        const candle = chartDataWithIndicators[i];
        const buyAction = actionNodes.find(n => n.data.actionType === 'buy');
        const sellAction = actionNodes.find(n => n.data.actionType === 'sell');
        
        let shouldBuy = false;
        if (buyAction) {
            shouldBuy = checkConditionsForAction(i, buyAction.id);
        }

        let shouldSell = false;
        if (sellAction) {
            shouldSell = checkConditionsForAction(i, sellAction.id);
        }

        if (shouldBuy && !inPosition) {
            inPosition = true;
            trades.push({ time: candle.time, type: 'buy', price: candle.price });
        } else if (shouldSell && inPosition) {
            const entryTrade = trades.filter(t => t.type === 'buy').pop();
            if(entryTrade) {
                const profit = candle.price - entryTrade.price;
                 if (profit > 0) {
                    totalProfit += profit;
                    winningTrades++;
                } else {
                    totalLoss += Math.abs(profit);
                    losingTrades++;
                }
                portfolioValue += profit;
            }
            inPosition = false;
            trades.push({ time: candle.time, type: 'sell', price: candle.price });
        }

        pnlData.push({ time: candle.time, pnl: portfolioValue });

        if (portfolioValue > peakPortfolio) {
            peakPortfolio = portfolioValue;
        }
        const drawdown = (peakPortfolio - portfolioValue) / peakPortfolio;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    const totalTrades = winningTrades + losingTrades;
    const stats = {
      netProfit: (portfolioValue - 10000) / 10000 * 100,
      totalTrades: totalTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      maxDrawdown: maxDrawdown * 100,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
    }

    // Add indicator values to ohlcData for the chart tooltip
    const finalChartData = chartDataWithIndicators.map((d, i) => {
        const dataPoint: any = {...d};
        indicatorNodes.forEach(node => {
            const indicatorKey = `${node.data.indicatorType.toUpperCase()}(${node.data.period})`;
            dataPoint[indicatorKey] = signals[node.id]?.[i];
        });
        return dataPoint;
    });

    return { ohlcData: finalChartData, tradeData: trades, pnlData, stats };
};

// Custom Shape for Scatter Markers
const TradeMarker = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.type) return null;
    const isBuy = payload.type === 'buy';
    // Position markers slightly above/below the line
    const yOffset = isBuy ? 10 : -10;
    const markerY = cy + yOffset;
    
    if (isBuy) {
        return <ArrowUp x={cx - 8} y={markerY} width={16} height={16} className="text-green-500 fill-current" />;
    }
    return <ArrowDown x={cx - 8} y={markerY - 16} width={16} height={16} className="text-red-500 fill-current" />;
};

// Custom Tooltip for combined chart
const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (active && payload && payload.length) {
        const priceData = payload.find(p => p.dataKey === 'price')?.payload;
        const pnlData = payload.find(p => p.dataKey === 'pnl');
        const trade = payload.find(p => p.dataKey === 'tradeMarker')?.payload;

        return (
            <div className="p-2 bg-slate-800/80 border border-slate-700 rounded-md text-white text-xs backdrop-blur-sm">
                <p className="font-bold">{`Tarih: ${label}`}</p>
                {priceData && <p>Fiyat: <span className="font-mono">${priceData.price.toFixed(2)}</span></p>}
                {pnlData && <p>Kâr: <span className="font-mono">${pnlData.value?.toFixed(2)}</span></p>}
                {priceData && Object.keys(priceData).filter(k => k.includes('(')).map(key => (
                     priceData[key] && <p key={key}>{key}: <span className="font-mono">{priceData[key].toFixed(2)}</span></p>
                ))}
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
  const searchParams = useSearchParams();

  useEffect(() => {
    const symbol = searchParams.get('symbol');
    if (symbol) {
      setNodes((nds) => 
        nds.map((node) => {
          if (node.type === 'dataSource') {
            return { ...node, data: { ...node.data, symbol } };
          }
          return node;
        })
      );
    }
  }, [searchParams, setNodes]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );
  
  const handleOptimizePeriod = (nodeId: string) => {
    const nodeToOptimize = nodes.find(n => n.id === nodeId);
    if (!nodeToOptimize) return;

    let bestPeriod = nodeToOptimize.data.period;
    let bestProfitFactor = -Infinity;

    // Brute-force check for periods from 7 to 30
    for (let period = 7; period <= 30; period++) {
      const tempNodes = nodes.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, period: period } };
        }
        return n;
      });

      const result = runBacktestEngine(tempNodes, edges);
      if (!('error' in result) && result.stats.profitFactor > bestProfitFactor && isFinite(result.stats.profitFactor)) {
        bestProfitFactor = result.stats.profitFactor;
        bestPeriod = period;
      }
    }
    
    // Update the node with the best found period
    setNodes(nds =>
      nds.map(n => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, period: bestPeriod } };
        }
        return n;
      })
    );
    
    toast({
        title: "Optimizasyon Tamamlandı!",
        description: `En iyi periyot ${bestPeriod} olarak bulundu (Kâr Faktörü: ${bestProfitFactor.toFixed(2)}).`
    })
  };


  const nodeTypes = useMemo(() => ({
    indicator: (props: NodeProps) => <IndicatorNode {...props} data={{ ...props.data, onOptimize: handleOptimizePeriod }} />,
    logic: LogicNode,
    action: ActionNode,
    dataSource: DataSourceNode,
  }), []); 


  const addNode = useCallback((type: string) => {
    const newNodeId = `${type}-${Date.now()}`;
    let nodeLabel = "Yeni Düğüm";
    let nodeData = {};
    
    const position = {
        x: 250 + Math.random() * 150,
        y: 100 + Math.random() * 150,
    };

    if (type === 'dataSource') {
        nodeLabel = 'Veri Kaynağı';
        nodeData = { label: nodeLabel, exchange: 'binance', symbol: 'BTC/USDT' };
    } else if (type === 'indicator') {
      nodeLabel = 'Yeni İndikatör';
      nodeData = { label: nodeLabel, indicatorType: 'rsi', period: 14 };
    } else if (type === 'logic') {
      nodeLabel = 'Yeni Koşul';
      nodeData = { label: nodeLabel, operator: 'lt', value: 30 };
    } else if (type === 'action') {
      nodeLabel = 'Yeni İşlem';
      nodeData = { label: nodeLabel, actionType: 'buy' };
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
        const dataSourceNode = nodes.find(n => n.type === 'dataSource');
        const symbol = dataSourceNode?.data.symbol || 'BTC/USDT';

        const newBot: Bot = {
          id: Date.now(),
          name: botName,
          pair: symbol,
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
        toast({
            title: 'İşlem İptal Edildi',
            description: 'Bot için bir isim girmediniz.',
            variant: 'secondary'
        });
    }
  };
  
  const handleBacktest = () => {
    setIsBacktesting(true);
    setBacktestResult(null);
    setIsBacktestModalOpen(true); // Open modal immediately
    try {
        setTimeout(() => {
            const result = runBacktestEngine(nodes, edges);
            if ('error' in result) {
                toast({
                    title: 'Backtest Hatası',
                    description: result.error,
                    variant: 'destructive',
                });
                setIsBacktesting(false);
                setIsBacktestModalOpen(false); // Close modal on error
                return;
            }
            setBacktestResult(result);
            setIsBacktesting(false);
        }, 1500);
    } catch (error) {
        console.error("Backtest sırasında hata:", error);
        toast({
            title: 'Beklenmedik Hata',
            description: 'Backtest motoru çalıştırılamadı.',
            variant: 'destructive',
        });
        setIsBacktesting(false);
        setIsBacktestModalOpen(false);
    }
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
        tradeMarker: trade ? { ...trade, price: ohlc.price } : undefined,
      };
    });
  }, [backtestResult]);
  
  const indicatorKeys = useMemo(() => {
    if (!backtestResult || !backtestResult.ohlcData.length) return [];
    const firstDataPoint = backtestResult.ohlcData[0];
    return Object.keys(firstDataPoint).filter(key => key.includes('('));
  }, [backtestResult]);
  
  // A flag to check if there is an oscillator indicator like RSI
  const hasOscillator = useMemo(() => {
    return indicatorKeys.some(key => key.startsWith('RSI'));
  }, [indicatorKeys]);

  return (
    <div className="flex flex-1 flex-row overflow-hidden">
        <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 p-4 flex flex-col gap-2">
            <h3 className="font-bold text-lg text-foreground mb-4 font-headline">Araç Kutusu</h3>
             <Button variant="outline" className="justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-white border-slate-700" onClick={() => addNode('dataSource')}>
                <Database className="text-yellow-500" /> Veri Kaynağı Ekle
            </Button>
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

        <main className="flex-1 relative">
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
                     {isBacktesting || !backtestResult ? (
                        <div className="flex flex-1 items-center justify-center">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : (
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
                           <ResponsiveContainer width="100%" height={hasOscillator ? "70%" : "100%"}>
                               <ComposedChart data={chartAndTradeData} syncId="backtestChart">
                                    <defs>
                                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3"/>
                                    <XAxis dataKey="time" tick={{fontSize: 12}} stroke="rgba(255,255,255,0.4)" />
                                    <YAxis 
                                        yAxisId="pnl" 
                                        orientation="left"
                                        domain={['auto', 'auto']} 
                                        tickFormatter={(val: number) => `$${val.toLocaleString()}`}
                                        tick={{fontSize: 12}}
                                        stroke="hsl(var(--primary))"
                                    />
                                    <YAxis 
                                        yAxisId="price" 
                                        orientation="right"
                                        domain={['dataMin * 0.98', 'dataMax * 1.02']} 
                                        tickFormatter={(val: number) => `$${(val/1000).toFixed(1)}k`}
                                        tick={{fontSize: 12}}
                                        stroke="hsl(var(--accent))"
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    
                                    <Area yAxisId="pnl" type="monotone" dataKey="pnl" name="Kümülatif Kâr" stroke="hsl(var(--primary))" fill="url(#colorPnl)" />
                                    
                                    <Line yAxisId="price" type="monotone" dataKey="price" name="Fiyat" stroke="hsl(var(--accent))" dot={false} strokeWidth={2} />
                                     {indicatorKeys.filter(k => !k.startsWith('RSI')).map((key, index) => (
                                        <Line key={key} yAxisId="price" type="monotone" dataKey={key} name={key} stroke={["#facc15", "#38bdf8"][(index) % 2]} dot={false} strokeWidth={1.5} />
                                    ))}
                                    
                                    <Scatter yAxisId="price" name="İşlemler" dataKey="tradeMarker.price" fill="transparent" shape={<TradeMarker />} />
                                </ComposedChart>
                            </ResponsiveContainer>
                            {hasOscillator && (
                                <ResponsiveContainer width="100%" height="30%">
                                    <ComposedChart data={chartAndTradeData} syncId="backtestChart" margin={{left: 0, right: 10, top: 20}}>
                                        <CartesianGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3"/>
                                        <XAxis dataKey="time" hide={true}/>
                                        <YAxis yAxisId="indicator" orientation="right" domain={[0, 100]} tickCount={4} tick={{fontSize: 12}} stroke="rgba(255,255,255,0.4)" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <ReferenceLine yAxisId="indicator" y={70} label={{value: "70", position: 'insideRight', fill: 'rgba(255,255,255,0.5)', fontSize: 10}} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                        <ReferenceLine yAxisId="indicator" y={30} label={{value: "30", position: 'insideRight', fill: 'rgba(255,255,255,0.5)', fontSize: 10}} stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                                        {indicatorKeys.filter(k => k.startsWith('RSI')).map((key, index) => (
                                            <Line key={key} yAxisId="indicator" type="monotone" dataKey={key} stroke={["#eab308", "#3b82f6"][index % 2]} fillOpacity={0.2} name={key} dot={false}/>
                                        ))}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                    )}
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
                        {/* Trading Mode */}
                        <div>
                            <h3 className="text-lg font-semibold font-headline mb-4">İşlem Modu</h3>
                             <Select value={strategyConfig.mode} onValueChange={(value: 'LIVE' | 'PAPER') => handleConfigChange('mode', value)}>
                                <SelectTrigger className="bg-slate-800 border-slate-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                                    <SelectItem value="PAPER">Paper (Sanal Bakiye)</SelectItem>
                                    <SelectItem value="LIVE">Live (Gerçek Bakiye - API Gerekli)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground mt-2">
                                {strategyConfig.mode === 'PAPER' 
                                    ? 'Strateji, 10,000 USDT sanal bakiye ile test edilecektir.' 
                                    : 'Strateji, ayarlardaki borsa API anahtarlarınızı kullanarak gerçek emirler gönderecektir.'}
                            </p>
                        </div>

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
                                <Label htmlFor="trailing-stop">Trailing Stop Kullan</Label>                            </div>
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

    