'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DecisionNodeData } from '@/lib/tree/buildTree';

const KIND_STYLES: Record<string, { ring: string; accent: string; label: string }> = {
  DISEASE_TYPE: { ring: 'border-blue-200 bg-blue-50', accent: 'text-blue-700', label: 'Disease' },
  DISEASE_STATE: { ring: 'border-violet-200 bg-violet-50', accent: 'text-violet-700', label: 'State' },
  LINE_OF_THERAPY: { ring: 'border-amber-200 bg-amber-50', accent: 'text-amber-700', label: 'Line' },
  BIOMARKER: { ring: 'border-emerald-200 bg-emerald-50', accent: 'text-emerald-700', label: 'Biomarker' },
};

export function DecisionNode({ data }: NodeProps) {
  const d = data as DecisionNodeData;
  const style = KIND_STYLES[d.kind] ?? KIND_STYLES.DISEASE_TYPE;
  const hasCount = typeof d.trialCount === 'number';
  return (
    <div className={`w-full rounded-xl border px-3 py-2 text-center shadow-sm ${style.ring}`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-300" />
      <div className={`text-[0.62rem] font-bold uppercase tracking-widest ${style.accent}`}>
        {d.tag ?? style.label}
      </div>
      <div className="text-base font-bold leading-tight text-slate-800">{d.label}</div>
      {hasCount && (
        <div className="mt-1 flex items-center justify-center gap-1 text-[0.7rem] font-semibold">
          <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200">
            {d.trialCount} trial{d.trialCount === 1 ? '' : 's'}
          </span>
          {!!d.recruitingCount && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
              {d.recruitingCount} recruiting
            </span>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-slate-300" />
    </div>
  );
}
