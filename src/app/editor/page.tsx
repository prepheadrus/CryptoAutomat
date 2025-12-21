
'use client';

import React, { useState, useCallback, useRef } from 'react';
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
import { Loader2, Rss, GitBranch, CircleDollarSign, Terminal } from 'lucide-react';
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

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
];

type LogEntry = {
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'SIMULATION';
  message: string;
};


export default function StrategyEditorPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isCompiling, setIsCompiling] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry['type'], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [...prevLogs, { timestamp, type, message }]);
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges],
  );

  const addNode = useCallback((type: string) => {
    const newNodeId = `${type}-${Date.now()}`;
    let nodeLabel = "Yeni Düğüm";
    let nodeData = {};
    
    // Position nodes in the center with a random offset
    const position = {
        x: 400 + (Math.random() - 0.5) * 200,
        y: 200 + (Math.random() - 0.5) * 100,
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
    addLog('INFO', 'Strateji testi başlatılıyor...');

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
      
      const logType = data.message.includes('[SİMÜLASYON]') ? 'SIMULATION' : 'SUCCESS';
      addLog(logType, data.message);

    } catch (error) {
       const errorMessage = (error as Error).message;
       addLog('ERROR', errorMessage);
    } finally {
      setIsCompiling(false);
    }
  };
  
  const getLogColor = (type: LogEntry['type']) => {
    switch(type) {
      case 'INFO': return 'text-slate-400';
      case 'SUCCESS': return 'text-green-400';
      case 'ERROR': return 'text-red-500';
      case 'SIMULATION': return 'text-yellow-400';
      default: return 'text-white';
    }
  }

  return (
    <div className="flex flex-row h-full w-full bg-slate-950 overflow-hidden">
        <aside className="w-64 h-full flex-shrink-0 border-r border-slate-800 bg-slate-900 p-4 flex flex-col gap-2">
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

        <main className="flex-1 flex flex-col h-full">
            <div ref={reactFlowWrapper} className="flex-1 relative w-full min-h-0">
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
                    <Button variant="secondary">
                        Kaydet
                    </Button>
                </div>
            </div>
            
            <div className="h-48 w-full bg-black border-t border-slate-800 overflow-y-auto font-mono text-sm p-2">
                 <div className="flex items-center gap-2 text-slate-500 border-b border-slate-800 pb-2 mb-2">
                    <Terminal size={16}/> 
                    <h4 className="font-bold">Sistem Kayıtları</h4>
                </div>
                {logs.map((log, index) => (
                    <p key={index} className={getLogColor(log.type)}>
                        <span className="text-slate-600 mr-2">{log.timestamp}</span>
                        <span className="font-bold mr-2">[{log.type}]</span>
                        {log.message}
                    </p>
                ))}
                 {logs.length === 0 && <p className="text-slate-500">Test çıktısı burada görünecektir...</p>}
            </div>
        </main>
    </div>
  );
}

    