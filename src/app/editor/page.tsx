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
  MarkerType
} from '@xyflow/react';
import { useToast } from "@/hooks/use-toast"
import { Button } from '@/components/ui/button';
import { compileStrategy } from '@/lib/compiler';


// !!! EN ÖNEMLİ KISIM: BU SATIR OLMAZSA KUTULAR GÖRÜNMEZ !!!
import '@xyflow/react/dist/style.css';

// Özel düğümlerimizi içe aktarıyoruz (NAMED IMPORT OLARAK)
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
const initialNodes = [
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
  const { toast } = useToast();

  // Bağlantı yapıldığında çalışır
  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  // Yeni düğüm ekleme fonksiyonu
  const addNode = (type: string, label: string) => {
    const id = (nodes.length + 1).toString();
    const newNode = {
      id,
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { label },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  // Derleme fonksiyonu
  const handleCompile = () => {
    const result = compileStrategy(nodes, edges);
    
    if (result.valid) {
      console.log("Derlenmiş Strateji:", result.strategy);
      toast({
        title: "Başarılı!",
        description: result.message,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Derleme Hatası",
        description: result.message,
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
          <Controls />
        </ReactFlow>

        {/* Yüzen Araç Paneli (Sol Üst) */}
        <div className="absolute top-4 left-4 z-10 bg-card border p-2 rounded-lg shadow-xl flex flex-col gap-2 w-56">
            <h3 className="font-bold px-2 py-1 text-sm">Araç Kutusu</h3>
            <Button variant="outline" size="sm" onClick={() => addNode('indicator', 'Yeni İndikatör')}>
                📊 İndikatör Ekle
            </Button>
            <Button variant="outline" size="sm" onClick={() => addNode('logic', 'Yeni Koşul')}>
                ⚡ Mantık/Koşul Ekle
            </Button>
            <Button variant="outline" size="sm" onClick={() => addNode('action', 'Yeni İşlem')}>
                💰 İşlem (Al/Sat) Ekle
            </Button>
        </div>

        {/* Yüzen Aksiyon Paneli (Sağ Üst) */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button onClick={handleCompile}>
                ▶ Stratejiyi Derle
            </Button>
        </div>
    </div>
  );
}
