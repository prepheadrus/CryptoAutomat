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
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { compileStrategy } from '@/lib/compiler';
import { runStrategy } from '@/lib/bot-engine'; // Bu importu kullanacağız
import { IndicatorNode } from '@/components/editor/nodes/IndicatorNode';
import { LogicNode } from '@/components/editor/nodes/LogicNode';
import { ActionNode } from '@/components/editor/nodes/ActionNode';

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

  const handleCompileAndRun = async () => {
    setIsCompiling(true);
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
      
      // Başarılı sonucu kullanıcıya göster
      window.alert(`[BAŞARILI] ${data.message}`);

    } catch (error) {
       // Hata durumunu kullanıcıya göster
       window.alert(`[HATA] ${(error as Error).message}`);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 relative bg-slate-950">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-950"
        >
          <Background color="#334155" gap={20} size={1} />
          <Controls />
        </ReactFlow>

        <div className="absolute top-4 left-4 z-10 bg-card border p-2 rounded-lg shadow-xl flex flex-col gap-2 w-56">
            <h3 className="font-bold px-2 py-1 text-sm">Araç Kutusu</h3>
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
            <Button onClick={handleCompileAndRun} disabled={isCompiling}>
                 {isCompiling ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Çalıştırılıyor...</>
                ) : (
                    "▶ Stratejiyi Test Et"
                )}
            </Button>
             <Button variant="secondary">Kaydet</Button>
        </div>
      </div>
    </div>
  );
}