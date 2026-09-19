'use client';

import { useEffect } from 'react';
import { CENTERS } from '@/lib/locations';
import { RIBBON_STRIPE } from '@/lib/cancerColors';
import type { TreeFilter } from '@/types';

type Props = {
  pis: string[];
  diseases: string[];
  filter: TreeFilter;
  connected: boolean;
  lastSummary: string | null;
  onChange: (next: TreeFilter) => void;
  /** Below lg the sidebar is an off-canvas drawer; this says whether it's showing. */
  open: boolean;
  /** Close the drawer (backdrop tap, ✕ button, Escape). */
  onClose: () => void;
};

/** From lg up the sidebar is always on screen — there's no drawer to close. */
const DESKTOP_QUERY = '(min-width: 1024px)';

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
      className="text-blue-600"
      aria-hidden
    >
      <path d="M12 4v4M12 8l-6 5M12 8l6 5M6 13v3M18 13v3" />
      <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
      <circle cx="6" cy="13" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18" cy="13" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="6" cy="17.5" r="1.5" fill="#8b5cf6" stroke="none" />
      <circle cx="18" cy="17.5" r="1.5" fill="#f97316" stroke="none" />
    </svg>
  );
}

export function Sidebar({ pis, diseases, filter, connected, lastSummary, onChange, open, onClose }: Props) {
  // Escape closes the drawer. Capture phase + preventDefault, so a trial panel
  // open underneath (which also closes on Escape) stays open on the same key.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (window.matchMedia(DESKTOP_QUERY).matches) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Inputs are 16px below lg: iOS zooms the page when focusing anything smaller.
  const selectCls =
    'mt-1.5 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 transition-colors hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 lg:py-2 lg:text-sm';

  return (
    <>
      {/* Drawer backdrop (below lg only). */}
      {open && (
        <div aria-hidden onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" />
      )}

      {/* Below lg: an off-canvas drawer that slides in from the left, padded
          clear of the notch / home indicator (`invisible` when closed keeps it
          out of the tab order). From lg up: the original static sidebar. */}
      <aside
        id="admin-filters"
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(20rem,88vw)] shrink-0 flex-col gap-5 overflow-y-auto overscroll-contain border-r border-slate-200 bg-white px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pt-[max(1.25rem,env(safe-area-inset-top,0px))] shadow-2xl transition-[transform,visibility] duration-300 ease-out motion-reduce:transition-none ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        } lg:visible lg:relative lg:inset-auto lg:z-auto lg:w-80 lg:transform-none lg:overscroll-auto lg:p-5 lg:shadow-none lg:transition-none`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 ${RIBBON_STRIPE}`} />
        {/* Brand */}
        <div className="flex items-center gap-2 lg:gap-2.5">
          <TreeMark />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-lg font-extrabold tracking-tight text-slate-900">TrialTree</div>
            <div className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400 lg:overflow-visible lg:whitespace-normal lg:tracking-[0.22em]">
              GU Oncology · SoCal
            </div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-600">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {connected ? 'Live' : 'Reconnecting'}
          </span>
          {/* Close the drawer (below lg only). */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-base text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200 lg:py-2 lg:pr-8 lg:text-sm"
          />
          {filter.search ? (
            <button
              onClick={() => onChange({ ...filter, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-slate-400 hover:text-slate-700 lg:p-1"
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* AI finder */}
        <a
          href="/find"
          className="group flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-3 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift lg:py-2.5"
        >
          <span>✨</span> Find a trial with AI
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </a>

        {/* Filters */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">Filter</div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">Cancer type</label>
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
            <label className="block text-xs font-semibold text-slate-600">Hospital / center</label>
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
            <label className="block text-xs font-semibold text-slate-600">Principal investigator</label>
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-150 hover:border-slate-400 hover:bg-slate-100 active:scale-[0.98] lg:py-1.5"
              onClick={() => onChange({ locationSlug: null, pi: null, search: null, diseaseLabel: null })}
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <div className="font-semibold uppercase tracking-wider text-slate-400">Last live update</div>
          <div className="mt-1 text-slate-700">{lastSummary ?? 'Waiting for changes…'}</div>
        </div>

        <a
          href="/admin/review"
          className="group flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-3 text-center text-sm font-semibold text-slate-700 transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm lg:py-2"
        >
          Review queue
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </a>
      </aside>
    </>
  );
}
