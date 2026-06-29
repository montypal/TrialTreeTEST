'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TrialNodeData } from '@/lib/tree/buildTree';

export function TrialNode({ data }: NodeProps) {
  const d = data as TrialNodeData;
  // A trial leaf's accent reflects whether it is recruiting anywhere in view.
  const anyRecruiting = d.statuses.some((s) => s.status === 'RECRUITING');
  const accent = anyRecruiting ? 'border-green-500/70' : 'border-slate-600';

  return (
    <div className={`w-[230px] rounded-xl border-2 bg-slate-900/90 px-3 py-2 shadow-xl ${accent}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-500" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.62rem] font-bold uppercase tracking-widest text-blue-300">
          {d.phase ?? 'Trial'}
        </span>
        {d.nctId && <span className="text-[0.62rem] text-slate-400">{d.nctId}</span>}
      </div>

      <div className="mt-0.5 text-sm font-bold leading-snug text-slate-50">{d.title}</div>
      {d.pi && <div className="text-[0.7rem] text-slate-400">PI: {d.pi}</div>}

      <div className="mt-1.5 flex flex-wrap gap-1">
        {d.statuses.map((s, i) => (
          <span key={i} className={`pill pill-${s.status}`}>
            {s.locationName.split(' ')[0]}: {s.status[0] + s.status.slice(1).toLowerCase()}
          </span>
        ))}
      </div>

      {d.cohorts.length > 0 && (
        <div className="mt-1 text-[0.68rem] text-slate-400">
          Cohorts: {d.cohorts.map((c) => c.label).join(', ')}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  );
}
