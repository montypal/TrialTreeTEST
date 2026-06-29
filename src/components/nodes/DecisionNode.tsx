'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DecisionNodeData } from '@/lib/tree/buildTree';

const KIND_STYLES: Record<string, { ring: string; label: string }> = {
  DISEASE_TYPE: { ring: 'border-blue-400/70 bg-blue-500/10', label: 'Disease' },
  DISEASE_STATE: { ring: 'border-violet-400/70 bg-violet-500/10', label: 'State' },
  LINE_OF_THERAPY: { ring: 'border-amber-400/70 bg-amber-500/10', label: 'Line' },
  BIOMARKER: { ring: 'border-emerald-400/70 bg-emerald-500/10', label: 'Biomarker' },
};

export function DecisionNode({ data }: NodeProps) {
  const d = data as DecisionNodeData;
  const style = KIND_STYLES[d.kind] ?? KIND_STYLES.DISEASE_TYPE;
  return (
    <div
      className={`w-[230px] rounded-xl border-2 px-3 py-2 text-center shadow-lg ${style.ring}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />
      <div className="text-[0.62rem] font-bold uppercase tracking-widest text-slate-400">
        {style.label}
      </div>
      <div className="text-base font-bold leading-tight text-slate-50">{d.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  );
}
