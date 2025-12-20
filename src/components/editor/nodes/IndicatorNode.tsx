'use client';

import React, { useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Rss } from 'lucide-react';

export function IndicatorNode({ data, id }: NodeProps<{ label: string, onDataChange?: () => any, indicatorType?: string, period?: number }>) {
  const indicatorTypeRef = useRef(data.indicatorType || 'rsi');
  const periodRef = useRef(data.period || 14);

  useEffect(() => {
    data.onDataChange = () => ({
      indicatorType: indicatorTypeRef.current,
      period: periodRef.current,
    });
  }, [data]);


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
            <Select defaultValue={indicatorTypeRef.current} onValueChange={(value) => (indicatorTypeRef.current = value)}>
                <SelectTrigger id={`${id}-indicator-type`} className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="İndikatör seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="rsi">RSI</SelectItem>
                    <SelectItem value="sma">SMA</SelectItem>
                    <SelectItem value="ema">EMA</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor={`${id}-period`}>Periyot</Label>
            <Input id={`${id}-period`} type="number" defaultValue={periodRef.current} onChange={(e) => (periodRef.current = parseInt(e.target.value, 10))} className="bg-slate-700 border-slate-600 text-white" />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-blue-400 w-3 h-3" />
    </div>
  );
}
