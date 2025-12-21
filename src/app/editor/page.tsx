"use client";

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

import { Button } from '@/components/ui/button';
import { Loader2, Terminal, Rss, GitBranch, CircleDollarSign } from 'lucide-react';
import { IndicatorNode } from '@/components/editor/nodes/IndicatorNode';
import { LogicNode } from '@/components/editor/nodes/LogicNode';
import { ActionNode } from '@/components/editor/nodes/ActionNode';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const nodeTypes = {
  indicator: IndicatorNode,
  logic: LogicNode,
  action: ActionNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'indicator',
    position: { x: 50, y: 50 },
    data: { label: 'RSI İndikatörü', indicatorType: 'rsi', period: 14 }
  },
  {
    id: '2',
    type: 'logic',
    position: { x: 350, y: 50 },
    data: { label: 'Koşul', operator: 'lt', value: 30 }
  },
  {
    id: '3',
    type: 'action',
    position: { x: 650, y: 50 },
    data: { label: 'Alış Emri', actionType: 'buy', amount: 100 }
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
];


const Sidebar = ({ onAddNode }: { onAddNode: (type: string) => void }) => {
    return (
        <aside className="w-64 bg-card border-r flex flex-col gap-2 p-4">
            <h3 className="font-bold text-lg text-foreground mb-4">Araç Kutusu</h3>
             <Button variant="outline" className="justify-start gap-2" onClick={() => onAddNode('indicator')}>
                <Rss className="text-blue-500" /> İndikatör Ekle
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => onAddNode('logic')}>
                <GitBranch className="text-purple-500" /> Mantık Ekle
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => onAddNode('action')}>
                <CircleDollarSign className="text-green-500" /> İşlem Ekle
            </Button>
        </aside>
    );
};

export default function StrategyEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isCompiling, setIsCompiling] = useState(false);
  const [logs, setLogs] = useState<string[]>(['> [SİSTEM] Editör başlatıldı. Stratejinizi oluşturun veya test edin.']);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const addNode = useCallback((type: string) => {
    let nodeLabel = "Yeni Düğüm";
    let nodeData = {};
    const position = {
        x: Math.random() * 400,
        y: Math.random() * 400,
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
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: nodeData,
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);


  const handleRunStrategy = async () => {
    setIsCompiling(true);
    setLogs(prev => [...prev, '> [İSTEK] Strateji testi başlatılıyor...']);
    try {
      const response = await fetch('/api/run-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodes, edges }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Bilinmeyen bir test hatası oluştu.');
      }
      
      setLogs(prev => [...prev, `> [BAŞARILI] ${data.message}`]);

    } catch (error) {
       const errorMessage = (error as Error).message;
       setLogs(prev => [...prev, `> [HATA] ${errorMessage}`]);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex flex-row w-full h-full">
        <Sidebar onAddNode={addNode} />
        <main className="flex-1 relative flex flex-col">
            <div className="relative flex-1">
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
                    <Button onClick={handleRunStrategy} disabled={isCompiling}>
                        {isCompiling ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Çalıştırılıyor...</>
                        ) : (
                            "▶ Stratejiyi Test Et"
                        )}
                    </Button>
                    <Button variant="secondary" onClick={() => toast({ title: "Kaydedildi", description: "Stratejiniz başarıyla kaydedildi."})}>
                        Kaydet
                    </Button>
                </div>
            </div>
            
            <div className="h-48 z-10 bg-black/80 backdrop-blur-sm border-t border-slate-700 text-white font-mono">
                <div className="p-3 border-b border-slate-700 flex items-center gap-2">
                    <Terminal className="h-5 w-5"/>
                    <h3 className="font-bold text-sm">Sistem Kayıtları</h3>
                </div>
                <div className="p-4 text-sm overflow-y-auto h-[calc(100%-49px)]">
                {logs.map((log, index) => (
                    <p key={index} className={cn(
                    'whitespace-pre-wrap', 
                    log.includes('[HATA]') && 'text-red-400',
                    log.includes('[BAŞARILI]') && 'text-green-400',
                    log.includes('[İSTEK]') && 'text-yellow-400',
                    log.includes('[SİSTEM]') && 'text-slate-400',
                    log.includes('[SİMÜLASYON]') && 'text-cyan-400',
                    log.includes('[CANLI]') && 'text-green-400',
                    )}>
                    {log}
                    </p>
                ))}
                </div>
            </div>
        </main>
    </div>
  );
}
