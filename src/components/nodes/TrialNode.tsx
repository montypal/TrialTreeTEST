'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TrialNodeData } from '@/lib/tree/buildTree';

const DOT: Record<string, string> = {
  RECRUITING: 'bg-emerald-500',
  WAITLISTED: 'bg-amber-500',
  CLOSED: 'bg-slate-400',
  SUSPENDED: 'bg-rose-500',
};

export function TrialNode({ data }: NodeProps) {
  const d = data as TrialNodeData;
  const anyRecruiting = d.statuses.some((s) => s.status === 'RECRUITING');
  const accent = anyRecruiting ? 'border-emerald-300' : 'border-slate-200';

  if (d.compact) {
    // Small card used inside the trial grid (hundreds may render at once).
    return (
      <div className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white px-2 py-1.5 shadow-sm ${accent}`}>
        <Handle type="target" position={Position.Left} className="!h-1 !w-1 !bg-slate-300" />
        <div className="flex items-center justify-between gap-1">
          <span className="text-[0.55rem] font-bold uppercase tracking-wide text-blue-600">
            {d.phase ?? 'Trial'}
          </span>
          {d.nctId && <span className="text-[0.55rem] text-slate-400">{d.nctId}</span>}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[0.72rem] font-semibold leading-tight text-slate-800">
          {d.title}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          {d.statuses.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 text-[0.55rem] text-slate-500">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[s.status] ?? 'bg-slate-400'}`} />
              {s.short}
            </span>
          ))}
        </div>
        <Handle type="source" position={Position.Right} className="!h-1 !w-1 !bg-slate-300" />
      </div>
    );
  }

  // Full card (single-trial / small trees).
  return (
    <div className={`w-full rounded-xl border bg-white px-3 py-2 shadow-sm ${accent}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.62rem] font-bold uppercase tracking-widest text-blue-600">
          {d.phase ?? 'Trial'}
        </span>
        {d.nctId && <span className="text-[0.62rem] text-slate-400">{d.nctId}</span>}
      </div>
      <div className="mt-0.5 text-sm font-bold leading-snug text-slate-800">{d.title}</div>
      {d.pi && <div className="text-[0.7rem] text-slate-500">PI: {d.pi}</div>}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {d.statuses.map((s, i) => (
          <span key={i} className={`pill pill-${s.status}`}>
            {s.short}: {s.status[0] + s.status.slice(1).toLowerCase()}
          </span>
        ))}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </div>
  );
}
