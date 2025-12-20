'use client';

import React, { useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitBranch } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function LogicNode({ data, id }: NodeProps<{ label: string, onDataChange?: () => any, operator?: string, value?: number }>) {
    const operatorRef = useRef(data.operator || 'lt');
    const valueRef = useRef(data.value || 30);

    useEffect(() => {
        data.onDataChange = () => ({
            operator: operatorRef.current,
            value: valueRef.current,
        });
    }, [data]);

  return (
    <div className="bg-slate-800 border-2 border-slate-400 border-l-4 border-l-purple-500 rounded-lg shadow-xl w-64 text-white">
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-400" />
            <div className="font-bold">Mantık / Koşul</div>
        </div>
      </div>
      <div className="p-3 space-y-4">
        <div className="space-y-2">
            <Label htmlFor={`${id}-operator`}>Operatör</Label>
            <Select defaultValue={operatorRef.current} onValueChange={(value) => (operatorRef.current = value)}>
                <SelectTrigger id={`${id}-operator`} className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Operatör seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="gt">Büyüktür (&gt;)</SelectItem>
                    <SelectItem value="lt">Küçüktür (&lt;)</SelectItem>
                    <SelectItem value="crossover">Kesişim</SelectItem>
                </SelectContent>
            </Select>
        </div>
         <div className="space-y-2">
            <Label htmlFor={`${id}-value`}>Değer</Label>
            <Input id={`${id}-value`} type="number" defaultValue={valueRef.current} onChange={(e) => (valueRef.current = parseInt(e.target.value, 10))} className="bg-slate-700 border-slate-600 text-white" />
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-purple-400 w-3 h-3" />
      <Handle type="source" position={Position.Right} className="!bg-purple-400 w-3 h-3" />
    </div>
  );
}
