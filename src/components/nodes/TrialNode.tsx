'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TrialNodeData } from '@/lib/tree/buildTree';

const DOT: Record<string, string> = {
  RECRUITING: 'bg-green-400',
  WAITLISTED: 'bg-yellow-400',
  CLOSED: 'bg-slate-400',
  SUSPENDED: 'bg-red-400',
};

export function TrialNode({ data }: NodeProps) {
  const d = data as TrialNodeData;
  const anyRecruiting = d.statuses.some((s) => s.status === 'RECRUITING');
  const accent = anyRecruiting ? 'border-green-500/70' : 'border-slate-600';

  if (d.compact) {
    // Small card used inside the trial grid (hundreds may render at once).
    return (
      <div className={`w-full rounded-lg border-2 bg-slate-900/90 px-2 py-1.5 shadow-lg ${accent}`}>
        <Handle type="target" position={Position.Top} className="!h-1 !w-1 !bg-slate-600" />
        <div className="flex items-center justify-between gap-1">
          <span className="text-[0.55rem] font-bold uppercase tracking-wide text-blue-300">
            {d.phase ?? 'Trial'}
          </span>
          {d.nctId && <span className="text-[0.55rem] text-slate-500">{d.nctId}</span>}
        </div>
        <div className="mt-0.5 line-clamp-3 text-[0.72rem] font-semibold leading-tight text-slate-50">
          {d.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {d.statuses.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 text-[0.55rem] text-slate-300">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[s.status] ?? 'bg-slate-400'}`} />
              {s.short}
            </span>
          ))}
        </div>
        <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !bg-slate-600" />
      </div>
    );
  }

  // Full card (single-trial / small trees).
  return (
    <div className={`w-full rounded-xl border-2 bg-slate-900/90 px-3 py-2 shadow-xl ${accent}`}>
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
            {s.short}: {s.status[0] + s.status.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-500" />
    </div>
  );
}
