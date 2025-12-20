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
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { compileStrategy } from '@/lib/compiler';

import { IndicatorNode } from '@/components/editor/nodes/IndicatorNode';
import { LogicNode } from '@/components/editor/nodes/LogicNode';
import { ActionNode } from '@/components/editor/nodes/ActionNode';

// Düğüm tiplerini tanıtıyoruz
const nodeTypes = {
  indicator: IndicatorNode,
  logic: LogicNode,
  action: ActionNode,
};

// Başlangıç düğümleri (Boş gelmesin diye)
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
    type: 'action', _
    position: { x: 650, y: 150 }, 
    data: { label: 'Alış Emri', actionType: 'buy', amount: 100 } 
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2-3', source: '2', target: '3', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
];


export default function StrategyEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { toast } = useToast();

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const addNode = (type: string, label: string) => {
    const id = (nodes.length + 1).toString();
    const newNode = {
      id,
      type,
      position: { 
        x: window.innerWidth / 2 + Math.random() * 200 - 100, 
        y: window.innerHeight / 3 + Math.random() * 200 - 100
      },
      data: { label },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleCompile = () => {
    const result = compileStrategy(nodes, edges);
    
    if (result.valid) {
      console.log("Derlenmiş Strateji:", result.strategy);
      toast({
        title: "Başarılı!",
        description: result.message,
        variant: "default",
      });
    } else {
      toast({
        title: "Derleme Hatası",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full h-[calc(100vh-4rem)] relative bg-slate-950">
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
        <Controls className="bg-slate-800 border-slate-700 fill-slate-300" />
      </ReactFlow>

      {/* Yüzen Araç Paneli (Sol Üst) */}
      <div className="absolute top-4 left-4 z-50 bg-card border p-3 rounded-lg shadow-xl flex flex-col gap-3 w-52">
        <h3 className="font-bold text-center mb-1">Araç Kutusu</h3>
        <Button onClick={() => addNode('indicator', 'Yeni İndikatör')} variant="outline">
          📊 İndikatör Ekle
        </Button>
        <Button onClick={() => addNode('logic', 'Yeni Koşul')} variant="outline">
          ⚡ Mantık/Koşul Ekle
        </Button>
        <Button onClick={() => addNode('action', 'Yeni İşlem')} variant="outline">
          💰 İşlem (Al/Sat) Ekle
        </Button>
      </div>

      {/* Yüzen Aksiyon Paneli (Sağ Üst) */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <Button onClick={handleCompile} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg">
          ▶ Stratejiyi Derle
        </Button>
      </div>
    </div>
  );
}