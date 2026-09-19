'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import { TreeFlow } from '@/components/TreeFlow';
import { OutlineBrowser } from '@/components/OutlineBrowser';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { TrialDetail } from '@/components/TrialDetail';
import { DecisionTreeBackdrop } from '@/components/DecisionTreeBackdrop';
import { useTreeStream } from '@/components/useTreeStream';
import type { TreeFilter, TrialDTO } from '@/types';
import { CANCERS, CARD, DOT, hueFor } from '@/lib/cancerColors';

// Layout by breakpoint:
//  • phones (< md) and tablets (md): the sidebar is an off-canvas filter drawer,
//    and the top bar is an in-flow header strip above the canvas, so it never
//    covers the tree;
//  • desktop (lg+): the original layout — static sidebar, top bar floating over
//    the canvas.
export function AdminClient() {
  const [filter, setFilter] = useState<TreeFilter>({ locationSlug: null, pi: null });
  const [view, setView] = useState<'outline' | 'map'>('map');
  const [entered, setEntered] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TrialDTO | null>(null);
  // Filter drawer below lg (from lg up the sidebar is always shown).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  // Admin watches the global stream so it reflects changes at any center.
  const { data, loading, connected, lastSummary } = useTreeStream({});

  const diseases = useMemo(
    () => (data?.decisionNodes ?? []).filter((n) => n.kind === 'DISEASE_TYPE').map((n) => n.label),
    [data],
  );

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.trials.length;
    const recruiting = data.trials.filter((t) => t.locations.some((l) => l.status === 'RECRUITING')).length;
    const centers = new Set(data.trials.flatMap((t) => t.locations.map((l) => l.locationSlug))).size;
    return { total, recruiting, centers };
  }, [data]);

  // Per-cancer trial + recruiting counts, shown on the welcome cards.
  const diseaseStats = useMemo(() => {
    const m = new Map<string, { total: number; rec: number }>();
    if (!data) return m;
    const nodeById = new Map(data.decisionNodes.map((n) => [n.id, n] as const));
    const rootLabel = (nodeId: string): string | null => {
      let cur = nodeById.get(nodeId);
      let g = 0;
      while (cur && cur.parentId && g++ < 12) cur = nodeById.get(cur.parentId);
      return cur?.label ?? null;
    };
    for (const t of data.trials) {
      const label = rootLabel(t.decisionNodeId);
      if (!label) continue;
      const cur = m.get(label) ?? { total: 0, rec: 0 };
      cur.total += 1;
      if (t.locations.some((l) => l.status === 'RECRUITING')) cur.rec += 1;
      m.set(label, cur);
    }
    return m;
  }, [data]);

  // Breadcrumb for the stepped map — reflects the selected cancer + drill path.
  const crumbs = useMemo(() => {
    const arr: { id: string | null; label: string }[] = [{ id: null, label: 'Cancer types' }];
    if (!data) return arr;
    const nodeById = new Map(data.decisionNodes.map((n) => [n.id, n] as const));
    const diseaseNodeId = filter.diseaseLabel
      ? (data.decisionNodes.find((n) => !n.parentId && n.label === filter.diseaseLabel)?.id ?? null)
      : null;
    const eff = focusId ?? diseaseNodeId;
    if (!eff) return arr;
    const pushPath = (startId: string) => {
      const chain: { id: string; label: string }[] = [];
      let cur = nodeById.get(startId);
      let g = 0;
      while (cur && g++ < 12) {
        chain.unshift({ id: cur.id, label: cur.label });
        cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
      }
      for (const c of chain) arr.push(c);
    };
    if (eff.startsWith('grp:')) {
      const parts = eff.split(':');
      pushPath(parts[1]);
      arr.push({ id: eff, label: parts.slice(2).join(':') });
    } else {
      pushPath(eff);
    }
    return arr;
  }, [data, focusId, filter.diseaseLabel]);

  const currentCrumb = crumbs[crumbs.length - 1];
  const parentCrumb = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;

  // Tablet breadcrumb is one scrollable line: keep the current step in view.
  // (From lg up it wraps instead, so there's nothing to scroll.)
  const crumbBarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = crumbBarRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [crumbs, view]);

  // A narrowing filter is set in the drawer (the cancer type already shows in
  // the breadcrumb, so it doesn't count).
  const filtersActive = !!(filter.locationSlug || filter.pi || filter.search);

  const onNodeClick = useCallback(
    (_e: MouseEvent, node: Node) => {
      if (node.type === 'trial') {
        const id = node.id.replace(/^trial-/, '');
        setSelected(data?.trials.find((t) => t.id === id) ?? null);
      } else if (node.type === 'decision') {
        setFocusId(node.id); // drill one level (real node or grp: approach)
        setSelected(null);
      }
    },
    [data],
  );

  const chooseCancer = (label: string | null) => {
    setFilter((f) => ({ ...f, diseaseLabel: label }));
    setFocusId(null);
    setEntered(true);
  };

  // Jump to a breadcrumb step; the root crumb also clears the cancer choice.
  const goToCrumb = (id: string | null) => {
    if (id === null) setFilter((f) => ({ ...f, diseaseLabel: null }));
    setFocusId(id);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f6f7f9] text-slate-800 supports-[height:100dvh]:h-dvh">
      <Sidebar
        pis={data?.principalInvestigators ?? []}
        diseases={diseases}
        filter={filter}
        connected={connected}
        lastSummary={lastSummary}
        onChange={(f) => {
          setFilter(f);
          setFocusId(null);
        }}
        open={sidebarOpen}
        onClose={closeSidebar}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Top bar. Below lg: an in-flow header strip above the canvas —
            row 1 [Filters] [Map|Outline] … stats, row 2 the map navigation.
            From lg up: the original bar floating over the canvas. The blur is
            max-lg only so the lg bar has no backdrop-filter at all (it would
            stop the chips inside from frosting the canvas behind them). */}
        <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 p-2 pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:p-3 sm:pl-[max(0.75rem,env(safe-area-inset-left,0px))] sm:pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:pt-[max(0.75rem,env(safe-area-inset-top,0px))] max-lg:backdrop-blur lg:pointer-events-none lg:absolute lg:inset-x-0 lg:top-0 lg:flex-nowrap lg:justify-between lg:gap-3 lg:border-0 lg:bg-transparent lg:p-4">
          {/* `contents` below lg lets these join the strip's rows directly. */}
          <div className="pointer-events-auto contents items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label={filtersActive ? 'Filters (active)' : 'Filters'}
              aria-controls="admin-filters"
              aria-expanded={sidebarOpen}
              className="relative inline-flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 active:scale-95 lg:hidden"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 5h16l-6 7.5V18l-4 2v-7.5L4 5z" />
              </svg>
              <span className="hidden sm:inline">Filters</span>
              {filtersActive && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
              )}
            </button>

            <div className="flex gap-0.5 rounded-xl border border-slate-200 bg-white/80 p-0.5 text-xs font-semibold shadow-sm backdrop-blur">
              <button
                onClick={() => setView('map')}
                className={`rounded-lg px-3 py-[11px] transition-all duration-200 active:scale-95 lg:py-1.5 ${
                  view === 'map'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                ⊹ Map
              </button>
              <button
                onClick={() => setView('outline')}
                className={`rounded-lg px-3 py-[11px] transition-all duration-200 active:scale-95 lg:py-1.5 ${
                  view === 'outline'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                ☰ Outline
              </button>
            </div>

            {view === 'map' && (
              // Below lg: its own full-width row. From lg up (`contents`): the
              // breadcrumb sits right next to the toggle, as before.
              <div className="order-last flex min-h-[2.5rem] min-w-0 basis-full items-center lg:contents">
                {/* Phones: Back to the parent step + the current step. */}
                <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
                  {parentCrumb && (
                    <button
                      type="button"
                      onClick={() => goToCrumb(parentCrumb.id)}
                      aria-label={`Back to ${parentCrumb.label}`}
                      className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white pl-2 pr-3 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                      Back
                    </button>
                  )}
                  <span className="min-w-0 truncate px-1 text-sm font-semibold text-slate-900">
                    {currentCrumb.label}
                  </span>
                </div>

                {/* md: the full breadcrumb on one line (scrolls sideways if long).
                    lg: exactly as before — wraps, no scrolling. */}
                <nav
                  ref={crumbBarRef}
                  aria-label="Breadcrumb"
                  className="pointer-events-auto hidden w-fit max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur [scrollbar-width:none] md:flex lg:w-auto lg:max-w-none lg:flex-wrap lg:overflow-visible lg:whitespace-normal [&::-webkit-scrollbar]:hidden"
                >
                  {crumbs.map((c, i) => (
                    <span key={`${c.id ?? 'root'}-${i}`} className="flex items-center gap-1">
                      {i > 0 && <span className="text-slate-300">›</span>}
                      {i < crumbs.length - 1 ? (
                        <button
                          onClick={() => goToCrumb(c.id)}
                          className="rounded-md px-1.5 py-1 font-semibold text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700 lg:py-0.5"
                        >
                          {c.label}
                        </button>
                      ) : (
                        <span className="px-1.5 font-semibold text-slate-900">{c.label}</span>
                      )}
                    </span>
                  ))}
                </nav>
              </div>
            )}
          </div>

          {stats && (
            <div className="pointer-events-auto ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs shadow-sm backdrop-blur sm:gap-3 sm:px-4 lg:ml-0">
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-blue-600" aria-hidden>
                  <path d="M12 4v4M12 8l-6 5M12 8l6 5M6 13v3M18 13v3" />
                </svg>
                <span className="font-bold text-slate-900">{stats.total}</span>
                {/* Phones show just the numbers; the words stay for screen readers. */}
                <span className="sr-only text-slate-500 sm:not-sr-only">trials</span>
              </span>
              <span className="hidden text-slate-200 sm:inline">·</span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
                <span className="font-bold text-emerald-600">{stats.recruiting}</span>
                <span className="sr-only text-slate-500 sm:not-sr-only">recruiting</span>
              </span>
              <span className="hidden text-slate-200 lg:inline">·</span>
              <span className="hidden text-slate-500 lg:inline">{stats.centers} centers</span>
            </div>
          )}
        </div>

        {/* Canvas. The absolute inner layer gives the tree a definite height. */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">
            {loading || !data ? (
              <div className="flex h-full items-center justify-center text-xl text-slate-400">
                Loading trials…
              </div>
            ) : view === 'outline' ? (
              <div className="h-full lg:pt-16">
                <OutlineBrowser data={data} filter={filter} onSelectTrial={setSelected} />
              </div>
            ) : (
              <TreeFlow
                data={data}
                filter={filter}
                stepped
                focusNodeId={focusId}
                onNodeClick={onNodeClick}
                onPaneClick={() => setSelected(null)}
              />
            )}
          </div>
        </div>

        {/* Entry prompt: pick a cancer type to explore. Scrolls when it's taller
            than the screen; the backdrop stays pinned behind it. */}
        {!loading && data && !entered && (
          <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#f6f7f9] text-center">
            <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
              <div className="aurora">
                <div className="aurora-3" />
              </div>
              <DecisionTreeBackdrop className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.55]" />
            </div>
            <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-4 py-10 pb-[calc(2.5rem_+_env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[calc(2.5rem_+_env(safe-area-inset-top,0px))] lg:p-6">
              <div className="w-full animate-fade-up lg:w-auto">
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-blue-600">
                  GU Oncology Trial Map
                </div>
                <div className="mt-2 font-display text-3xl font-extrabold tracking-tight text-gradient sm:text-4xl lg:text-5xl">
                  Welcome to TrialTree
                </div>
                <p className="mt-3 text-slate-500">Which cancer would you like to explore?</p>

                {/* Phones: one column of compact rows. sm–lg: two columns.
                    lg: the original row of tall cards. */}
                <div className="mx-auto mt-6 grid w-full max-w-md grid-cols-1 gap-3 sm:max-w-2xl sm:grid-cols-2 lg:mt-8 lg:flex lg:w-auto lg:max-w-none lg:flex-wrap lg:justify-center lg:gap-4">
                  {diseases.map((d) => {
                    const s = CARD[hueFor(d)];
                    const st = diseaseStats.get(d);
                    return (
                      <button
                        key={d}
                        onClick={() => chooseCancer(d)}
                        className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${s.grad} p-4 text-left shadow-card transition-all duration-300 hover:-translate-y-1.5 ${s.hover} hover:shadow-lift lg:block lg:w-60 lg:p-6`}
                      >
                        <span className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
                        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-xl font-extrabold ${s.badge}`}>
                          {d[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-lg font-bold leading-tight text-slate-900 lg:mt-3">{d}</div>
                          <div className="mt-0.5 text-sm text-slate-500 lg:mt-1">
                            {st ? (
                              <>
                                <span className="font-semibold text-slate-700">{st.total}</span> trials
                                {st.rec > 0 && <span className="text-emerald-600"> · {st.rec} recruiting</span>}
                              </>
                            ) : (
                              'View trials'
                            )}
                          </div>
                        </div>
                        <div className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-700 lg:mt-4">
                          <span className="hidden lg:inline">Explore</span>
                          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => chooseCancer(null)}
                  className="mt-3 px-3 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-900 lg:mt-7 lg:p-0"
                >
                  Or view all GU cancers →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Color legend — sits where the minimap was; explains the node colors.
            Tablet and up only; kept clear of the home indicator / notch. */}
        {view === 'map' && entered && data && !selected && (
          <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-10 hidden animate-fade-up md:block lg:bottom-4 lg:right-4">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-[0.7rem] shadow-card backdrop-blur">
              <div className="mb-2 font-semibold uppercase tracking-wider text-slate-400">Legend</div>
              {/* Nodes are colored by cancer (ribbon colors); the tag on each
                  node spells out its axis (Stage / Histology / Line). */}
              <div className="flex items-center gap-4">
                {CANCERS.map((c) => (
                  <LegendDot key={c.label} color={DOT[c.hue]} label={c.short} />
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-4 border-t border-slate-100 pt-2 text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Recruiting
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Closed
                </span>
              </div>
            </div>
          </div>
        )}

        {selected && <TrialDetail trial={selected} onClose={() => setSelected(null)} />}

        {/* Local-only real-time simulator (removed from production builds). */}
        <DevTools />
      </main>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span className={`h-2.5 w-2.5 rounded-[4px] ${color}`} />
      {label}
    </span>
  );
}
