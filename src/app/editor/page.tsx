"use client";

import React, { useState, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { compileStrategy } from "@/lib/compiler";
import { Code, GitBranch, Rss, CircleDollarSign, TrendingUp, Filter, Save, Share2 } from "lucide-react";
import { IndicatorNode } from "@/components/editor/nodes/IndicatorNode";
import { LogicNode } from "@/components/editor/nodes/LogicNode";
import { ActionNode } from "@/components/editor/nodes/ActionNode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const nodeTypes = {
  indicator: IndicatorNode,
  logic: LogicNode,
  action: ActionNode,
};

const initialNodes: Node[] = [
  { id: "1", type: "indicator", position: { x: 100, y: 100 }, data: { label: 'RSI İndikatörü', indicatorType: 'RSI', period: 14 } },
  { id: "2", type: "logic", position: { x: 400, y: 100 }, data: { label: 'Değer 30 dan küçükse', operator: 'lt', value: 30 } },
  { id: "3", type: "action", position: { x: 700, y: 100 }, data: { label: '100 USDT Al', actionType: 'BUY', amount: 100 } },
];

const initialEdges: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true, style: { strokeWidth: 2 } },
    { id: 'e2-3', source: '2', target: '3', animated: true, style: { strokeWidth: 2 } },
];


export default function EditorPage() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const { toast } = useToast();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => {
        const updatedNodes = applyNodeChanges(changes, nds);
        // Handle data updates from custom nodes
        changes.forEach(change => {
            if (change.type === 'select' && change.selected === false) {
                 const node = updatedNodes.find(n => n.id === change.id);
                 if (node && node.data.onDataChange) {
                    const data = node.data.onDataChange();
                    const finalNodes = updatedNodes.map(n => n.id === node.id ? {...n, data: {...n.data, ...data}} : n)
                    setNodes(finalNodes)
                 }
            }
        })
        return updatedNodes;
      }),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true, style: { strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  let nodeIdCounter = 4;
  const getNewNodeId = () => `${nodeIdCounter++}`;

  const nodeTemplates = [
      { id: 'indicator', label: 'İndikatör', icon: Rss, type: 'indicator' },
      { id: 'logic', label: 'Mantık', icon: GitBranch, type: 'logic' },
      { id: 'action', label: 'İşlem', icon: CircleDollarSign, type: 'action' },
      { id: 'price_filter', label: 'Fiyat Filtresi', icon: Filter, type: 'default' },
      { id: 'trend_filter', label: 'Trend Filtresi', icon: TrendingUp, type: 'default' },
  ];

  const addNode = (nodeTemplate: typeof nodeTemplates[0]) => {
    const newNode: Node = {
      id: getNewNodeId(),
      type: nodeTemplate.type,
      position: {
        x: Math.random() * 400 + 200,
        y: Math.random() * 300 + 50,
      },
      data: { label: nodeTemplate.label },
    };
    setNodes((nds) => nds.concat(newNode));
  };
  
  const handleCompile = () => {
    // A simple way to trigger data update on nodes before compiling
    // In a real app, you might want a more robust state management
    const updatedNodes = nodes.map(n => {
        if (n.data.onDataChange) {
            return {...n, data: {...n.data, ...n.data.onDataChange()}}
        }
        return n;
    })
    setNodes(updatedNodes);

    const result = compileStrategy(updatedNodes, edges);
    console.log(result);

    if (result.valid) {
      toast({
        title: "Strateji Başarıyla Derlendi",
        description: (
          <ScrollArea className="h-40 mt-2">
            <pre className="mt-2 w-[340px] rounded-md bg-black/80 p-4">
              <code className="text-white">{JSON.stringify(result.strategy, null, 2)}</code>
            </pre>
          </ScrollArea>
        ),
      });
    } else {
      toast({
        variant: "destructive",
        title: "Derleme Başarısız",
        description: result.message,
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] -m-4 md:-m-6">
      <div className="flex-grow rounded-lg text-card-foreground w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls />
        </ReactFlow>
        <div className="absolute top-4 left-4">
            <Card className="w-72 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-lg">Strateji: RSI Momentum</CardTitle>
                    <CardDescription>RSI aşırı satım bölgesindeyken alım yapar.</CardDescription>
                </CardHeader>
            </Card>
        </div>
        <div className="absolute top-4 right-4 space-x-2">
            <Button onClick={handleCompile} variant="outline" className="bg-card/80 backdrop-blur-sm hover:bg-card"><Code className="mr-2 h-4 w-4" /> Derle</Button>
            <Button><Save className="mr-2 h-4 w-4" /> Kaydet ve Yayınla</Button>
        </div>
        <div className="absolute bottom-4 left-4 space-y-2">
            {nodeTemplates.map(nodeType => (
              <Button key={nodeType.id} variant="secondary" size="sm" className="w-full justify-start" onClick={() => addNode(nodeType)}>
                <nodeType.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {nodeType.label} Ekle
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
