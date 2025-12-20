'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CircleDollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ActionNode({ data, id }: NodeProps<{ label: string, onDataChange?: () => any, actionType?: string, amount?: number }>) {
  const [action, setAction] = useState(data.actionType || 'buy');

  const actionTypeRef = useRef(data.actionType || 'buy');
  const amountRef = useRef(data.amount || 100);

  useEffect(() => {
    data.onDataChange = () => ({
      actionType: actionTypeRef.current,
      amount: amountRef.current,
    });
  }, [data]);


  const handleActionChange = (value: string) => {
    setAction(value);
    actionTypeRef.current = value;
  }

  const borderColor = action === 'buy' ? 'border-l-green-500' : 'border-l-red-500';
  const iconColor = action === 'buy' ? 'text-green-400' : 'text-red-400';

  return (
    <div className={cn("bg-slate-800 border-2 border-slate-400 border-l-4 rounded-lg shadow-xl w-64 text-white", borderColor)}>
        <div className="p-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
                <CircleDollarSign className={cn("h-5 w-5", iconColor)} />
                <div className="font-bold">İşlem</div>
            </div>
        </div>
      <div className="p-3 space-y-4">
        <div className="space-y-2">
            <Label htmlFor={`${id}-action-type`}>İşlem</Label>
            <Select defaultValue={actionTypeRef.current} onValueChange={handleActionChange}>
                <SelectTrigger id={`${id}-action-type`} className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="İşlem seçin" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="buy">Al</SelectItem>
                    <SelectItem value="sell">Sat</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label htmlFor={`${id}-amount`}>Miktar (USDT)</Label>
            <Input id={`${id}-amount`} type="number" defaultValue={amountRef.current} onChange={(e) => (amountRef.current = parseInt(e.target.value, 10))} className="bg-slate-700 border-slate-600 text-white" />
        </div>
      </div>
      <Handle type="target" position={Position.Left} className={cn("w-3 h-3", action === 'buy' ? '!bg-green-400' : '!bg-red-400')} />
    </div>
  );
}
