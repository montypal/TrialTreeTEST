'use client';

import { CENTERS } from '@/lib/locations';
import type { TreeFilter } from '@/types';

type Props = {
  pis: string[];
  filter: TreeFilter;
  connected: boolean;
  lastSummary: string | null;
  onChange: (next: TreeFilter) => void;
};

export function Sidebar({ pis, filter, connected, lastSummary, onChange }: Props) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-r border-slate-800 bg-slate-950/80 p-5">
      <div>
        <h1 className="text-xl font-extrabold">TrialTree</h1>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <span
            className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-500'}`}
          />
          {connected ? 'Live' : 'Reconnecting…'}
        </div>
      </div>

      <a
        href="/find"
        className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-center text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
      >
        ✨ Find a trial with AI
      </a>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Hospital / Center
        </label>
        <select
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          value={filter.locationSlug ?? ''}
          onChange={(e) => onChange({ ...filter, locationSlug: e.target.value || null })}
        >
          <option value="">All centers</option>
          {CENTERS.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Principal Investigator
        </label>
        <select
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          value={filter.pi ?? ''}
          onChange={(e) => onChange({ ...filter, pi: e.target.value || null })}
        >
          <option value="">All PIs</option>
          {pis.map((pi) => (
            <option key={pi} value={pi}>
              {pi}
            </option>
          ))}
        </select>
      </div>

      <button
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-800"
        onClick={() => onChange({ locationSlug: null, pi: null })}
      >
        Reset filters
      </button>

      <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
        <div className="font-semibold text-slate-300">Last live update</div>
        <div className="mt-1">{lastSummary ?? 'Waiting for changes…'}</div>
      </div>

      <a
        href="/admin/review"
        className="rounded-lg bg-amber-600/90 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-amber-500"
      >
        Review queue →
      </a>
    </aside>
  );
}
