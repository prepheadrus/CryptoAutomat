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
import { Loader2, Terminal } from 'lucide-react';
import { IndicatorNode } from '@/components/editor/nodes/IndicatorNode';
import { LogicNode } from '@/components/editor/nodes/LogicNode';
import { ActionNode } from '@/components/editor/nodes/ActionNode';
import { cn } from '@/lib/utils';

const nodeTypes = {
  indicator: IndicatorNode,
  logic: LogicNode,
  action: ActionNode,
};

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

export default function StrategyEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [logs, setLogs] = useState<string[]>(['> [SİSTEM] Editör başlatıldı. Test için hazır.']);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const addNode = (type: 'indicator' | 'logic' | 'action') => {
    const id = `${Date.now()}`;
    let nodeLabel = "Yeni Düğüm";
    if (type === 'indicator') nodeLabel = 'Yeni İndikatör';
    if (type === 'logic') nodeLabel = 'Yeni Koşul';
    if (type === 'action') nodeLabel = 'Yeni İşlem';
    
    const newNode: Node = {
      id,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 200 },
      data: { label: nodeLabel },
    };
    setNodes((nds) => nds.concat(newNode));
  };

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
    <div className="w-full h-full relative">
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

      {/* Floating UI Panels */}
      <div className="absolute top-4 left-4 z-10 bg-card/80 backdrop-blur-sm border p-2 rounded-lg shadow-xl flex flex-col gap-2 w-56">
          <h3 className="font-bold px-2 py-1 text-sm text-foreground">Araç Kutusu</h3>
          <Button variant="outline" size="sm" onClick={() => addNode('indicator')}>
              📊 İndikatör Ekle
          </Button>
          <Button variant="outline" size="sm" onClick={() => addNode('logic')}>
              ⚡ Mantık/Koşul Ekle
          </Button>
          <Button variant="outline" size="sm" onClick={() => addNode('action')}>
              💰 İşlem (Al/Sat) Ekle
          </Button>
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
          <Button onClick={handleRunStrategy} disabled={isCompiling}>
               {isCompiling ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Çalıştırılıyor...</>
              ) : (
                  "▶ Stratejiyi Test Et"
              )}
          </Button>
           <Button variant="secondary">Kaydet</Button>
      </div>
      
      {/* Floating Log Panel */}
      <div className="absolute bottom-0 left-0 right-0 h-48 z-10 bg-black/80 backdrop-blur-sm border-t border-slate-700 text-white font-mono">
        <div className="p-3 border-b border-slate-700 flex items-center gap-2">
          <Terminal className="h-5 w-5"/>
          <h3 className="font-bold text-sm">Sistem Kayıtları</h3>
        </div>
        <div className="p-4 text-sm overflow-y-auto h-[calc(100%-49px)]">
          {logs.map((log, index) => (
            <p key={index} className={cn(
              log.includes('[HATA]') && 'text-red-400',
              log.includes('[BAŞARILI]') && 'text-green-400',
              log.includes('[İSTEK]') && 'text-yellow-400',
            )}>
              {log}
            </p>
          ))}
        </div>
      </div>
    </div>
  );

    