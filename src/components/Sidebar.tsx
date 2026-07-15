'use client';

import { CENTERS } from '@/lib/locations';
import type { TreeFilter } from '@/types';

type Props = {
  pis: string[];
  diseases: string[];
  filter: TreeFilter;
  connected: boolean;
  lastSummary: string | null;
  onChange: (next: TreeFilter) => void;
};

function TreeMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="text-blue-400"
      aria-hidden
    >
      <path d="M12 4v4M12 8l-6 5M12 8l6 5M6 13v3M18 13v3" />
      <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
      <circle cx="6" cy="13" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="6" cy="17.5" r="1.5" fill="#34d399" stroke="none" />
      <circle cx="18" cy="17.5" r="1.5" fill="#34d399" stroke="none" />
    </svg>
  );
}

export function Sidebar({ pis, diseases, filter, connected, lastSummary, onChange }: Props) {
  const selectCls =
    'mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none';

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-800 bg-slate-950 p-5">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <TreeMark />
        <div className="leading-tight">
          <div className="text-lg font-extrabold tracking-tight text-slate-50">TrialTree</div>
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
            GU Oncology · SoCal
          </div>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-300">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-500'}`} />
          {connected ? 'Live' : 'Reconnecting'}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={filter.search ?? ''}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          placeholder="Search trial, NCT, drug, PI…"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-8 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        {filter.search ? (
          <button
            onClick={() => onChange({ ...filter, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200"
            aria-label="Clear search"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* AI finder */}
      <a
        href="/find"
        className="rounded-lg border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-center text-sm font-semibold text-blue-200 hover:bg-blue-500/20"
      >
        ✨ Find a trial with AI
      </a>

      {/* Filters */}
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Filter</div>
        <div>
          <label className="block text-xs font-semibold text-slate-400">Cancer type</label>
          <select
            className={selectCls}
            value={filter.diseaseLabel ?? ''}
            onChange={(e) => onChange({ ...filter, diseaseLabel: e.target.value || null })}
          >
            <option value="">All GU cancers</option>
            {diseases.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400">Hospital / center</label>
          <select
            className={selectCls}
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
          <label className="block text-xs font-semibold text-slate-400">Principal investigator</label>
          <select
            className={selectCls}
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

        {(filter.locationSlug || filter.pi || filter.search || filter.diseaseLabel) && (
          <button
            className="w-full rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            onClick={() => onChange({ locationSlug: null, pi: null, search: null, diseaseLabel: null })}
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        <div className="font-semibold uppercase tracking-wider text-slate-500">Last live update</div>
        <div className="mt-1 text-slate-300">{lastSummary ?? 'Waiting for changes…'}</div>
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
