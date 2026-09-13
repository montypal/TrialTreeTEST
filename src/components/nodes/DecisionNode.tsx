'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DecisionNodeData } from '@/lib/tree/buildTree';
import { NODE } from '@/lib/cancerColors';

// Fallback axis labels for nodes without a curated tag.
const KIND_LABEL: Record<string, string> = {
  DISEASE_TYPE: 'Disease',
  DISEASE_STATE: 'State',
  LINE_OF_THERAPY: 'Line',
  BIOMARKER: 'Biomarker',
};

export function DecisionNode({ data }: NodeProps) {
  const d = data as DecisionNodeData;
  // Tinted by cancer (prostate blue / bladder purple / kidney orange), fading
  // from the root toward the leaves.
  const style = NODE[d.hue ?? 'slate'][d.kind] ?? NODE.slate.DISEASE_TYPE;
  const hasCount = typeof d.trialCount === 'number';
  return (
    <div className={`w-full rounded-xl border px-3 py-2 text-center shadow-sm ${style.box}`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-300" />
      <div className={`text-[0.62rem] font-bold uppercase tracking-widest ${style.accent}`}>
        {d.tag ?? KIND_LABEL[d.kind] ?? ''}
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
