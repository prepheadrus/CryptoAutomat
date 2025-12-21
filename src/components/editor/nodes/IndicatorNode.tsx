'use client';

import React from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Rss, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function IndicatorNode({ data, id }: NodeProps<{ indicatorType?: string, period?: number, onOptimize: (nodeId: string) => void }>) {
  const { setNodes } = useReactFlow();
  const { toast } = useToast();

  // Helper to update node data
  const updateNodeData = (key: string, value: any) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          node.data = { ...node.data, [key]: value };
        }
        return node;
      })
    );
  };
  
  const handleOptimizeClick = () => {
    toast({
        title: "Optimizasyon Başlatıldı...",
        description: "En iyi parametreler aranıyor. Lütfen bekleyin."
    })
    if (data.onOptimize) {
      data.onOptimize(id);
    }
  }

  return (
    <div className="bg-slate-800 border-2 border-slate-400 border-l-4 border-l-blue-500 rounded-lg shadow-xl w-64 text-white">
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
            <Rss className="h-5 w-5 text-blue-400" />
            <div className="font-bold">İndikatör</div>
        </div>
      </div>
      <div className="p-3 space-y-4">
        <div className="space-y-2">
            <Label htmlFor={`${id}-indicator-type`}>İndikatör Tipi</Label>
            <Select 
              defaultValue={data.indicatorType || 'rsi'} 
              onValueChange={(value) => updateNodeData('indicatorType', value)}
            >
                <SelectTrigger id={`${id}-indicator-type`} className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="İndikatör seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="rsi">RSI</SelectItem>
                    <SelectItem value="sma">SMA</SelectItem>
                    <SelectItem value="ema">EMA</SelectItem>
                    <SelectItem value="macd" disabled>MACD (Yakında)</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor={`${id}-period`}>Periyot</Label>
            <Input 
              id={`${id}-period`} 
              type="number" 
              key={data.period} // Add key to force re-render on data change
              defaultValue={data.period || 14} 
              onChange={(e) => updateNodeData('period', parseInt(e.target.value, 10))}
              className="bg-slate-700 border-slate-600 text-white" 
            />
        </div>
        <Button onClick={handleOptimizeClick} variant="outline" size="sm" className="w-full gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300">
            <Zap className="h-4 w-4" />
            Periyodu Optimize Et
        </Button>
      </div>
      <Handle type="target" position={Position.Left} className={cn("w-3 h-3 !bg-blue-400")} />
      <Handle type="source" position={Position.Right} className="!bg-blue-400 w-3 h-3" />
    </div>
  );
}
