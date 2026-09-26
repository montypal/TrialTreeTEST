'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { Node } from '@xyflow/react';
import { TreeFlow } from '@/components/TreeFlow';
import { OutlineBrowser } from '@/components/OutlineBrowser';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { TrialDetail } from '@/components/TrialDetail';
import { DecisionTreeBackdrop } from '@/components/DecisionTreeBackdrop';
import { useTreeStream } from '@/components/useTreeStream';
import { MORE_NODE_TYPE } from '@/lib/tree/buildTree';
import type { TreeFilter, TrialDTO } from '@/types';
import { CANCERS, CARD, DOT, hueFor } from '@/lib/cancerColors';

// The browse experience behind both /explore (public) and /admin (legacy URL).
//
// Layout:
//  • The header strip is always in-flow, at every breakpoint. It used to float
//    over the canvas from lg up, which was fine while the tree sat in a small
//    island in the middle — now that a level is sized to fill the canvas, a
//    floating bar sits on top of cards. In-flow also means the canvas height is
//    an honest number, which matters because the tree is laid out against it.
//  • Phones and tablets get the sidebar as an off-canvas filter drawer; from lg
//    up it is static, as before.

type Props = {
  /** True when a parent route (that is, /explore) already owns the viewport
      height and has put the site header above us. */
  embedded?: boolean;
  /** A cancer chosen before arriving — the homepage's category cards link to
      /explore?disease=<root label> — so the visitor lands inside that tree
      rather than being asked the same question twice. Checked against the
      real root nodes once the data arrives. */
  initialDisease?: string | null;
};

export function AdminClient({ embedded = false, initialDisease = null }: Props) {
  const [filter, setFilter] = useState<TreeFilter>({
    locationSlug: null,
    pi: null,
    diseaseLabel: initialDisease,
  });
  const [view, setView] = useState<'outline' | 'map'>('map');
  const [entered, setEntered] = useState(!!initialDisease);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TrialDTO | null>(null);
  // A level pages its trial cards rather than shrinking them past legible; this
  // is the reader overriding that for the level they're looking at.
  const [showAllTrials, setShowAllTrials] = useState(false);
  const [counts, setCounts] = useState({ shown: 0, total: 0 });
  // Filter drawer below lg (from lg up the sidebar is always shown).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  // Admin watches the global stream so it reflects changes at any center.
  const { data, loading, connected, lastSummary } = useTreeStream({});

  // Same numbers in → same object out, so the canvas reporting an unchanged
  // count doesn't re-render the shell around it.
  const handleCounts = useCallback((shown: number, total: number) => {
    setCounts((c) => (c.shown === shown && c.total === total ? c : { shown, total }));
  }, []);

  const diseases = useMemo(
    () => (data?.decisionNodes ?? []).filter((n) => n.kind === 'DISEASE_TYPE').map((n) => n.label),
    [data],
  );

  // A deep link names its cancer by label, and labels live in the database, not
  // in the URL's author's head. If it names no real root (a stale link, a typo,
  // a tree that was renamed), fall back to the chooser rather than rendering an
  // empty tree that looks like "no trials".
  useEffect(() => {
    if (!data || !filter.diseaseLabel || diseases.includes(filter.diseaseLabel)) return;
    setFilter((f) => ({ ...f, diseaseLabel: null }));
    setEntered(false);
  }, [data, diseases, filter.diseaseLabel]);

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
    pushPath(eff);
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

  // Moving to another level always re-plans how many trials fit, so an earlier
  // "show everything" is not carried into a level the reader hasn't seen yet.
  const drillTo = useCallback((id: string | null) => {
    setFocusId(id);
    setShowAllTrials(false);
  }, []);

  const onNodeClick = useCallback(
    (_e: MouseEvent, node: Node) => {
      if (node.type === 'trial') {
        const id = node.id.replace(/^trial-/, '');
        setSelected(data?.trials.find((t) => t.id === id) ?? null);
      } else if (node.type === MORE_NODE_TYPE) {
        setShowAllTrials(true);
      } else if (node.type === 'decision') {
        // The pinned "Viewing · X" card is where you already are, not a choice.
        // React Flow fires onNodeClick on the wrapper whatever the node renders,
        // so without this a click would quietly collapse "Show all" back to the
        // paged view.
        if ((node.data as { context?: boolean }).context) return;
        setFocusId(node.id); // drill one level
        setShowAllTrials(false);
        setSelected(null);
      }
    },
    [data],
  );

  const chooseCancer = (label: string | null) => {
    setFilter((f) => ({ ...f, diseaseLabel: label }));
    drillTo(null);
    setEntered(true);
  };

  // Jump to a breadcrumb step; the root crumb also clears the cancer choice.
  const goToCrumb = (id: string | null) => {
    if (id === null) setFilter((f) => ({ ...f, diseaseLabel: null }));
    drillTo(id);
  };

  // While the "which cancer?" chooser covers the browse area, what is behind it
  // must leave the tab order too — otherwise Tab walks into the sidebar and the
  // canvas controls underneath an opaque panel and the focus ring disappears.
  // `inert` is set through the DOM because React 18's types do not know it.
  const deepLinkInvalid = !!data && !!filter.diseaseLabel && !diseases.includes(filter.diseaseLabel);
  const gated = !loading && !!data && (!entered || deepLinkInvalid);
  const coveredRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    coveredRef.current?.toggleAttribute('inert', gated);
  }, [gated]);

  // On /explore the site header already pays for the notch inset; paying for it
  // again here would just be a band of dead space.
  const barTopPad = embedded
    ? 'pt-2 sm:pt-3'
    : 'pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:pt-[max(0.75rem,env(safe-area-inset-top,0px))]';

  // Standalone, the shell owns the viewport; embedded, /explore already does and
  // this fills what is left. Either way the width is w-full rather than w-screen:
  // 100vw counts the scrollbar gutter, so on a desktop that shows one the shell
  // would be ~15px wider than the body and scroll sideways.
  return (
    <div
      className={`relative flex overflow-hidden bg-[#f6f7f9] text-slate-800 ${
        embedded ? 'h-full w-full' : 'h-screen w-full supports-[height:100dvh]:h-dvh'
      }`}
    >
      <div ref={coveredRef} aria-hidden={gated || undefined} className="flex min-w-0 flex-1">
      <Sidebar
        pis={data?.principalInvestigators ?? []}
        diseases={diseases}
        filter={filter}
        connected={connected}
        lastSummary={lastSummary}
        onChange={(f) => {
          setFilter(f);
          drillTo(null);
        }}
        open={sidebarOpen}
        onClose={closeSidebar}
        showAdminLinks={!embedded}
      />
      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Header strip: row 1 [Filters] [Map|Outline] … stats, row 2 the map
            navigation. Identical at every breakpoint — see the note up top. */}
        <div
          className={`relative z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 p-2 pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] backdrop-blur sm:gap-3 sm:p-3 sm:pl-[max(0.75rem,env(safe-area-inset-left,0px))] sm:pr-[max(0.75rem,env(safe-area-inset-right,0px))] ${barTopPad}`}
        >
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

          {/* The vertical padding is spelled out rather than picked off the spacing
              scale because it is answering a hard number: 14px either side of a
              16px line box is a 44px target, the phone floor. From lg up there is
              a pointer instead of a thumb, so it collapses back to a normal chip. */}
          <div className="flex shrink-0 gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-sm">
            <button
              type="button"
              onClick={() => setView('map')}
              aria-pressed={view === 'map'}
              className={`rounded-lg px-3 py-[0.875rem] transition-all duration-200 active:scale-95 lg:py-1.5 ${
                view === 'map'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span aria-hidden>⊹</span> Map
            </button>
            <button
              type="button"
              onClick={() => setView('outline')}
              aria-pressed={view === 'outline'}
              className={`rounded-lg px-3 py-[0.875rem] transition-all duration-200 active:scale-95 lg:py-1.5 ${
                view === 'outline'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span aria-hidden>☰</span> Outline
            </button>
          </div>

          {stats && (
            <div className="ml-auto flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm sm:gap-3 sm:px-4">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  className="text-blue-600"
                  aria-hidden
                >
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

          {/* The colour key used to float in the bottom-right of the canvas,
              where it now covers cards. It rides along in the strip from xl up,
              and the Outline view spells the same thing out in words. */}
          <div className="hidden shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[0.7rem] text-slate-600 shadow-sm xl:flex">
            {CANCERS.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-[4px] ${DOT[c.hue]}`} aria-hidden />
                {c.short}
              </span>
            ))}
            <span className="text-slate-200">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Recruiting
            </span>
          </div>

          {view === 'map' && (
            // Its own full-width row, so a long path never squeezes the
            // controls above it.
            <div className="flex min-h-[2.5rem] w-full min-w-0 basis-full items-center">
              {/* Phones and tablets: Back to the parent step + the current step.
                  Runs through lg because an iPad in portrait is touch hardware
                  too, and the breadcrumb's crumbs are sized for a pointer. */}
              <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
                {parentCrumb && (
                  <button
                    type="button"
                    onClick={() => goToCrumb(parentCrumb.id)}
                    aria-label={`Back to ${parentCrumb.label}`}
                    className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white pl-2 pr-3 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:text-blue-700 active:scale-95"
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

              {/* lg+: the full breadcrumb, wrapping rather than scrolling. */}
              <nav
                ref={crumbBarRef}
                aria-label="Breadcrumb"
                className="hidden w-auto flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm lg:flex"
              >
                {crumbs.map((c, i) => (
                  <span key={`${c.id ?? 'root'}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-300">›</span>}
                    {i < crumbs.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => goToCrumb(c.id)}
                        // Only shown from lg up, where there is a pointer; touch
                        // screens below that step back with the 44px Back button.
                        className="rounded-md px-1.5 py-0.5 font-semibold text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                      >
                        {c.label}
                      </button>
                    ) : (
                      <span aria-current="step" className="px-1.5 font-semibold text-slate-900">
                        {c.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
          )}
        </div>

        {/* Canvas. min-h-0 lets it give up height to the strip above instead of
            overflowing the shell; the absolute inner layer turns whatever is
            left into a definite height, which is the number TreeFlow measures
            and lays the level out against. */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0">
            {loading || !data ? (
              <div className="flex h-full items-center justify-center text-xl text-slate-500">
                Loading trials…
              </div>
            ) : view === 'outline' ? (
              <OutlineBrowser data={data} filter={filter} onSelectTrial={setSelected} />
            ) : (
              <TreeFlow
                data={data}
                filter={filter}
                stepped
                focusNodeId={focusId}
                showAllTrials={showAllTrials}
                onNodeClick={onNodeClick}
                onPaneClick={() => setSelected(null)}
                onCounts={handleCounts}
                toolbar={
                  <LevelStatus
                    shown={counts.shown}
                    total={counts.total}
                    expanded={showAllTrials}
                    onShowAll={() => setShowAllTrials(true)}
                    onShowFewer={() => setShowAllTrials(false)}
                  />
                }
              />
            )}
          </div>
        </div>

        {selected && <TrialDetail trial={selected} onClose={() => setSelected(null)} />}

        {/* Local-only real-time simulator (removed from production builds). */}
        <DevTools />
      </main>
      </div>

      {/* Entry prompt: pick a cancer type to explore. Absolutely positioned
          inside this shell rather than fixed to the window, so on /explore it
          covers the browse area and leaves the site navigation reachable. It
          sits below the site header's z-50 so the header's mobile menu, which
          drops down over exactly this area, still paints on top of it.
          Scrolls when it's taller than the shell; the backdrop stays pinned. */}
      {gated && (
        <div className="absolute inset-0 z-30 overflow-y-auto overscroll-contain bg-[#f6f7f9] text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="aurora">
              <div className="aurora-3" />
            </div>
            <DecisionTreeBackdrop className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.55]" />
          </div>
          <div className="relative z-10 flex min-h-full flex-col items-center justify-center px-4 py-10 pb-[calc(2.5rem_+_env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-10 lg:p-6">
            <div className="w-full animate-fade-up lg:w-auto">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-blue-600">
                GU Oncology Trial Map
              </div>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-gradient sm:text-4xl lg:text-5xl">
                Welcome to TrialTree
              </h1>
              <p className="mt-3 text-slate-500">Which cancer would you like to explore?</p>

              {/* Phones: one column of compact rows. sm–lg: two columns.
                  lg: a row of tall cards. */}
              <div className="mx-auto mt-6 grid w-full max-w-md grid-cols-1 gap-3 sm:max-w-2xl sm:grid-cols-2 lg:mt-8 lg:flex lg:w-auto lg:max-w-none lg:flex-wrap lg:justify-center lg:gap-4">
                {diseases.map((d) => {
                  const s = CARD[hueFor(d)];
                  const st = diseaseStats.get(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => chooseCancer(d)}
                      className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${s.grad} p-4 text-left shadow-card transition-all duration-300 hover:-translate-y-1.5 ${s.hover} hover:shadow-lift lg:block lg:w-60 lg:p-6`}
                    >
                      <span className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
                      <span
                        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-xl font-extrabold ${s.badge}`}
                        aria-hidden
                      >
                        {d[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-lg font-bold leading-tight text-slate-900 lg:mt-3">
                          {d}
                        </div>
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
                        <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                          →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => chooseCancer(null)}
                className="mt-3 px-3 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-900 lg:mt-7 lg:p-0"
              >
                Or view all GU cancers →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Says what the level is showing. A canvas that quietly renders 8 of 15 trials
 * is worse than one that renders 8 and puts the other 7 one tap away, so the
 * count is stated either way — never only when something is hidden.
 */
function LevelStatus({
  shown,
  total,
  expanded,
  onShowAll,
  onShowFewer,
}: {
  shown: number;
  total: number;
  expanded: boolean;
  onShowAll: () => void;
  onShowFewer: () => void;
}) {
  const strong = 'font-semibold text-slate-700';
  if (total === 0) {
    return <span>Select a branch to step deeper into the tree.</span>;
  }
  if (shown < total) {
    return (
      <>
        <span>
          Showing <span className={strong}>{shown}</span> of <span className={strong}>{total}</span> trials
          at this step
        </span>
        <StatusButton onClick={onShowAll}>Show all {total}</StatusButton>
      </>
    );
  }
  return (
    <>
      <span>
        Showing all <span className={strong}>{total}</span> trial{total === 1 ? '' : 's'} at this step
      </span>
      {expanded && total > 1 && <StatusButton onClick={onShowFewer}>Show fewer</StatusButton>}
    </>
  );
}

function StatusButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[0.7rem] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700 sm:h-7"
    >
      {children}
    </button>
  );
}
