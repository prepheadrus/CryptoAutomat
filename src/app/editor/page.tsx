'use client';

import React, { useState, useCallback } from 'react';
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Rss, GitBranch, CircleDollarSign, Save, Play, X as XIcon } from 'lucide-react';
import { IndicatorNode } from '@/components/editor/nodes/IndicatorNode';
import { LogicNode } from '@/components/editor/nodes/LogicNode';
import { ActionNode } from '@/components/editor/nodes/ActionNode';
import type { Bot } from '@/lib/types';


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

const backtestChartData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  profit: 10000 + (i * 40) + (Math.sin(i / 3) * 200) + (Math.random() * 150 * (i/5)),
}));


export default function StrategyEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState(false);
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
                <Button variant="secondary" onClick={handleSaveStrategy} disabled={isCompiling || isBacktesting}>
                    <Save className="mr-2 h-4 w-4" />
                    Kaydet
                </Button>
            </div>
        </main>
        
        {isBacktestModalOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/95 text-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 p-4">
                        <h2 className="text-xl font-headline font-semibold">Strateji Performans Raporu (Son 30 Gün)</h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsBacktestModalOpen(false)}>
                            <XIcon className="h-5 w-5"/>
                        </Button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                            <div className="rounded-lg bg-slate-800/50 p-4">
                                <p className="text-sm text-slate-400">Net Kâr</p>
                                <p className="text-2xl font-bold text-green-400">+$1,240.50 <span className="text-base font-medium">(%12.4)</span></p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-4">
                                <p className="text-sm text-slate-400">Toplam İşlem</p>
                                <p className="text-2xl font-bold">42</p>
                            </div>
                            <div className="rounded-lg bg-slate-800/50 p-4">
                                <p className="text-sm text-slate-400">Başarı Oranı</p>
                                <p className="text-2xl font-bold">68%</p>
                            </div>
                        </div>

                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={backtestChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={12} tickFormatter={(val) => `Gün ${val}`} />
                                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickFormatter={(val) => `$${(val/1000).toFixed(1)}k`}/>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            borderColor: '#334155',
                                            color: '#cbd5e1',
                                            borderRadius: '0.5rem',
                                        }}
                                        labelFormatter={(label) => `Gün ${label}`}
                                        formatter={(value: number) => [value.toLocaleString('en-US', {style: 'currency', currency: 'USD'}), 'Kümülatif Kâr']}
                                    />
                                    <Area type="monotone" dataKey="profit" stroke="hsl(var(--primary))" fill="url(#colorProfit)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                     <div className="flex justify-end border-t border-slate-800 p-4">
                        <Button onClick={() => setIsBacktestModalOpen(false)} variant="secondary">Kapat</Button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
}
