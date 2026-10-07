'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import type { Node } from '@xyflow/react';
import { TreeFlow } from '@/components/TreeFlow';
import { OutlineBrowser } from '@/components/OutlineBrowser';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { TrialDetail } from '@/components/TrialDetail';
import { DecisionTreeBackdrop } from '@/components/DecisionTreeBackdrop';
import { useTreeStream } from '@/components/useTreeStream';
import { MORE_NODE_TYPE } from '@/lib/tree/buildTree';
import { diseaseLabelFor } from '@/lib/tree/disease';
import { mailto, HOME_EVENT } from '@/lib/site';
import type { TreeFilter, TrialDTO } from '@/types';
import { CANCERS, CARD, DOT, hueFor } from '@/lib/cancerColors';
import { OrganIcon, organFor } from '@/components/icons/OrganIcon';

// The browse experience behind the homepage, and behind /explore and /admin,
// which render the same shell so older links keep working.
//
// Layout:
//  • The header strip is always in-flow, at every breakpoint. It used to float
//    over the canvas from lg up, which was fine while the tree sat in a small
//    island in the middle — now that a level is sized to fill the canvas, a
//    floating bar sits on top of cards. In-flow also means the canvas height is
//    an honest number, which matters because the tree is laid out against it.
//  • Phones and tablets get the sidebar as an off-canvas filter drawer; from lg
//    up it is static, as before.

/**
 * Where the reader is: on the welcome chooser, or inside a tree at a node.
 *
 * Every move is recorded as a browser history entry, so the browser's Back
 * button steps back through the moves and, from the top, returns to the welcome
 * screen — instead of leaving the site, which is what a single-page view does
 * when nothing is pushed. Only the entry's state is added to; the URL is left
 * alone, so Next's router sees no navigation and nothing is re-fetched or
 * remounted.
 */
type Nav = { entered: boolean; disease: string | null; focus: string | null };

const NAV_KEY = 'trialTreeNav';

/** Our slice of a history entry's state, if it has one. Defensive: history
    state is shared with Next's router and survives reloads. */
function readNav(state: unknown): Nav | null {
  if (!state || typeof state !== 'object') return null;
  const raw = (state as Record<string, unknown>)[NAV_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  return {
    entered: v.entered === true,
    disease: typeof v.disease === 'string' ? v.disease : null,
    focus: typeof v.focus === 'string' ? v.focus : null,
  };
}

function historyState(): Record<string, unknown> {
  const st: unknown = window.history.state;
  return st && typeof st === 'object' ? (st as Record<string, unknown>) : {};
}

type Props = {
  /** True when a parent (ExploreShell) already owns the viewport height and
      has put the site header above us. */
  embedded?: boolean;
  /** A cancer chosen before arriving — a shared link or QR code can carry
      ?disease=<root label> — so the visitor lands inside that tree rather
      than being asked the same question twice. Checked against the real root
      nodes once the data arrives. */
  initialDisease?: string | null;
};

/** Stand-ins for the cancer tiles until the tree arrives. Only the shape is
    drawn — no label and no number — so nothing here can be mistaken for data. */
const PLACEHOLDER_TILES = [0, 1, 2, 3];

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

  // The open trial's disease in words, read off where it hangs in the tree, so
  // the panel can say "Prostate Cancer › mCRPC" without storing it twice.
  const selectedDisease = useMemo((): string | null => {
    if (!selected || !data) return null;
    return diseaseLabelFor(selected.decisionNodeId, data.decisionNodes)?.full ?? null;
  }, [selected, data]);

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

  // Put the view at a place without recording it — for Back/Forward, and for
  // restoring where the reader was after a reload.
  const applyNav = useCallback((n: Nav) => {
    setEntered(n.entered);
    setFilter((f) => (f.diseaseLabel === n.disease ? f : { ...f, diseaseLabel: n.disease }));
    setFocusId(n.focus);
    setShowAllTrials(false);
    setSelected(null);
  }, []);

  // Go somewhere and record it, so the browser's Back returns here.
  const navigate = useCallback(
    (n: Nav) => {
      applyNav(n);
      try {
        window.history.pushState({ ...historyState(), [NAV_KEY]: n }, '');
      } catch {
        // History can be unavailable in unusual embeds; the move still happened.
      }
    },
    [applyNav],
  );

  useEffect(() => {
    // Returning to an entry we recorded (a reload keeps history state) puts the
    // reader back where they were; a fresh entry is stamped with where they
    // start, so Back from their first move lands on it.
    try {
      const existing = readNav(window.history.state);
      if (existing) {
        applyNav(existing);
      } else {
        const start: Nav = { entered: !!initialDisease, disease: initialDisease, focus: null };
        window.history.replaceState({ ...historyState(), [NAV_KEY]: start }, '');
      }
    } catch {
      // As above: without history the page still works, it just can't step back.
    }
    const onPop = (e: PopStateEvent) => {
      const n = readNav(e.state);
      if (n) applyNav(n);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyNav, initialDisease]);

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
        navigate({ entered: true, disease: filter.diseaseLabel ?? null, focus: node.id });
      }
    },
    [data, filter.diseaseLabel, navigate],
  );

  const chooseCancer = (label: string | null) => navigate({ entered: true, disease: label, focus: null });

  // "Cancer types", the first step of every path, IS the welcome screen — so
  // stepping back to it goes home, to the chooser, rather than to a second and
  // plainer list of the same four cancers.
  const goHome = () => navigate({ entered: false, disease: null, focus: null });

  // The header logo on "/" asks for the chooser (see HOME_EVENT). Read through a
  // ref so the listener is attached once but always calls the current goHome.
  // Already on the chooser, it does nothing: another history entry for the
  // same screen would only make Back look broken.
  const goHomeRef = useRef(goHome);
  goHomeRef.current = entered ? goHome : () => undefined;
  useEffect(() => {
    const onHome = () => goHomeRef.current();
    window.addEventListener(HOME_EVENT, onHome);
    return () => window.removeEventListener(HOME_EVENT, onHome);
  }, []);

  const goToCrumb = (id: string | null) => {
    if (id === null) goHome();
    else navigate({ entered: true, disease: filter.diseaseLabel ?? null, focus: id });
  };

  // While the "which cancer?" chooser covers the browse area, what is behind it
  // must leave the tab order too — otherwise Tab walks into the sidebar and the
  // canvas controls underneath an opaque panel and the focus ring disappears.
  // `inert` is set through the DOM because React 18's types do not know it.
  //
  // The chooser is the homepage's first screen, so it does not wait for the
  // data: until the tree arrives it stands with placeholder tiles, instead of
  // showing a first-time visitor the browse shell and "Loading trials…". A deep
  // link (entered from the start) still goes straight to its tree.
  const deepLinkInvalid = !!data && !!filter.diseaseLabel && !diseases.includes(filter.diseaseLabel);
  const gated = !entered || deepLinkInvalid;
  const coveredRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    coveredRef.current?.toggleAttribute('inert', gated);
  }, [gated]);

  // Embedded, the site header already pays for the notch inset; paying for it
  // again here would just be a band of dead space.
  const barTopPad = embedded
    ? 'pt-2 sm:pt-3'
    : 'pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:pt-[max(0.75rem,env(safe-area-inset-top,0px))]';

  // Standalone, the shell owns the viewport; embedded, ExploreShell already does
  // and this fills what is left. Either way the width is w-full rather than w-screen:
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
          if ((f.diseaseLabel ?? null) !== (filter.diseaseLabel ?? null)) {
            navigate({ entered: true, disease: f.diseaseLabel ?? null, focus: null });
          } else {
            drillTo(null);
          }
        }}
        open={sidebarOpen}
        onClose={closeSidebar}
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
                {/* Always present: from the top level it goes to the welcome screen. */}
                <button
                  type="button"
                  onClick={() => (parentCrumb ? goToCrumb(parentCrumb.id) : goHome())}
                  aria-label={
                    parentCrumb && parentCrumb.id !== null
                      ? `Back to ${parentCrumb.label}`
                      : 'Back to the start screen'
                  }
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
                    {c.id === null ? (
                      // The root crumb is always live, even when it is the
                      // current step: it is the way back to the welcome screen.
                      <button
                        type="button"
                        onClick={goHome}
                        title="Back to the start screen"
                        aria-current={i === crumbs.length - 1 ? 'step' : undefined}
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold transition-colors hover:bg-blue-50 hover:text-blue-700 ${
                          i === crumbs.length - 1 ? 'text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M3 11l9-7 9 7M5 10v10h14V10" />
                        </svg>
                        {c.label}
                      </button>
                    ) : i < crumbs.length - 1 ? (
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

        {selected && (
          <TrialDetail trial={selected} onClose={() => setSelected(null)} disease={selectedDisease} />
        )}

        {/* Local-only real-time simulator (removed from production builds). */}
        <DevTools />
      </main>
      </div>

      {/* Entry prompt — the homepage's first screen: pick a cancer type to
          explore. Absolutely positioned inside this shell rather than fixed to
          the window, so it covers the browse area and leaves the site
          navigation reachable. It sits below the site header's z-50 so the
          header's mobile menu, which drops down over exactly this area, still
          paints on top of it. Scrolls when it's taller than the shell. */}
      {gated && (
        <div className="absolute inset-0 z-30 overflow-y-auto overscroll-contain bg-[#f6f7f9] text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="aurora">
              <div className="aurora-3" />
            </div>
            <DecisionTreeBackdrop className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.55]" />
          </div>

          {/* Budgeted for a 360×640 phone: under the 56px header, the question,
              the counts and every cancer row fit in the first screen with no
              scrolling, and the footer line follows them. The question and the
              tiles share one centred group; the footer sits under it, at the
              bottom of the screen whenever there is room to spare. */}
          <div className="relative z-10 flex min-h-full flex-col items-center pb-[max(1rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-5 sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))] sm:pt-8 lg:pb-6 lg:pt-10">
            <div className="flex w-full max-w-md flex-1 animate-fade-up flex-col justify-center motion-reduce:animate-none sm:max-w-2xl lg:max-w-5xl">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-blue-700">
                GU Oncology Trial Map
              </p>
              <h1 className="mt-2 text-balance font-display text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                What cancer would you like to explore?
              </h1>
              {/* Counted from the loaded tree, never typed in: a stale figure on
                  a trial site is a clinical problem, not a copy problem. A
                  center counts once it has at least one trial here. */}
              <p className="mt-2 text-sm text-slate-500 sm:mt-3" aria-live="polite">
                {stats ? (
                  <>
                    <span className="font-semibold text-slate-700">{stats.total}</span>{' '}
                    {stats.total === 1 ? 'trial' : 'trials'}
                    <span aria-hidden className="mx-1.5 text-slate-300">
                      ·
                    </span>
                    <span className="sr-only">, </span>
                    <span className="font-semibold text-slate-700">{stats.centers}</span>{' '}
                    {stats.centers === 1 ? 'center' : 'centers'}
                  </>
                ) : (
                  'Loading trials…'
                )}
              </p>

              {/* Phones: one column of compact rows. sm–lg: two columns of rows.
                  lg up: one row of tall cards, centred, however many there are. */}
              <div className="mt-4 grid w-full grid-cols-1 gap-2 text-left sm:mt-6 sm:grid-cols-2 sm:gap-3 lg:mt-8 lg:flex lg:flex-wrap lg:justify-center lg:gap-4">
                {data
                  ? diseases.map((d) => {
                      const s = CARD[hueFor(d)];
                      const st = diseaseStats.get(d);
                      return (
                        // focus-visible:rounded-2xl: the global focus style
                        // rounds every focused element to 6px, which would
                        // square off the card's corners under the ring.
                        <button
                          key={d}
                          type="button"
                          onClick={() => chooseCancer(d)}
                          className={`group relative flex min-h-[4rem] w-full items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${s.grad} py-2.5 pl-4 pr-3 text-left shadow-card transition duration-200 ease-out ${s.hover} hover:shadow-lift focus-visible:rounded-2xl active:shadow-card motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] sm:gap-4 sm:p-4 sm:pl-5 lg:w-[13.5rem] lg:flex-col lg:items-start lg:gap-0 lg:p-5 xl:w-60`}
                        >
                          {/* The cancer's ribbon colour: down the left edge of a
                              row, across the top of a tall card. */}
                          <span
                            aria-hidden
                            className={`absolute inset-y-0 left-0 w-1 ${s.bar} lg:bottom-auto lg:right-0 lg:h-1 lg:w-auto`}
                          />
                          {/* The organ, drawn — not the cancer's initial. Decorative:
                              the label beside it carries the name. */}
                          <span
                            aria-hidden
                            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.badge} sm:h-12 sm:w-12 lg:h-16 lg:w-16 lg:rounded-2xl`}
                          >
                            <OrganIcon
                              name={organFor(d)}
                              hue={hueFor(d)}
                              className="h-8 w-8 sm:h-9 sm:w-9 lg:h-12 lg:w-12"
                            />
                          </span>
                          {/* flex-1 in a tall card pushes "Explore" to the bottom,
                              so it lines up across cards whose names wrap
                              differently. */}
                          <span className="min-w-0 flex-1 lg:mt-4 lg:w-full">
                            <span className="block font-display text-[0.9375rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-base lg:text-lg">
                              {d}
                            </span>
                            <span className="mt-0.5 block text-[0.8125rem] leading-5 text-slate-500 sm:text-sm lg:mt-1">
                              {st ? (
                                <>
                                  <span className="font-semibold text-slate-700">{st.total}</span>{' '}
                                  {st.total === 1 ? 'trial' : 'trials'}
                                  {st.rec > 0 && <span className="text-emerald-700"> · {st.rec} recruiting</span>}
                                </>
                              ) : (
                                'View trials'
                              )}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-slate-400 transition-colors duration-200 group-hover:text-slate-700 lg:mt-4 lg:text-slate-600"
                          >
                            <span className="hidden lg:inline">Explore</span>
                            <span className="transition-transform duration-200 motion-safe:group-hover:translate-x-1">
                              →
                            </span>
                          </span>
                        </button>
                      );
                    })
                  : PLACEHOLDER_TILES.map((i) => (
                      <div
                        key={i}
                        aria-hidden
                        className="flex min-h-[4rem] w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 py-2.5 pl-4 pr-3 sm:gap-4 sm:p-4 sm:pl-5 lg:min-h-[14rem] lg:w-[13.5rem] lg:flex-col lg:items-start lg:gap-0 lg:p-5 xl:w-60"
                      >
                        <span className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-200/80 motion-reduce:animate-none sm:h-12 sm:w-12 lg:h-16 lg:w-16 lg:rounded-2xl" />
                        <span className="min-w-0 flex-1 space-y-2 lg:mt-4 lg:w-full">
                          <span className="block h-3.5 w-3/5 animate-pulse rounded bg-slate-200/80 motion-reduce:animate-none" />
                          <span className="block h-3 w-2/5 animate-pulse rounded bg-slate-200/60 motion-reduce:animate-none" />
                        </span>
                      </div>
                    ))}
              </div>

              <button
                type="button"
                onClick={() => chooseCancer(null)}
                className="group mt-1 inline-flex h-11 items-center gap-1 self-center rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-white/70 hover:text-slate-900 focus-visible:rounded-xl sm:mt-3 lg:mt-5"
              >
                Or view all GU cancers
                <span aria-hidden className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">
                  →
                </span>
              </button>
            </div>

            {/* One quiet line, not a disclaimer block. The links are inline, so
                each one's tap area is stretched to 44px by an invisible
                ::after rather than by padding that would push the line apart
                and draw an oversized focus ring. */}
            <p className="mt-3 max-w-md text-balance text-xs leading-5 text-slate-500 sm:mt-6 sm:max-w-xl">
              <span className="font-semibold text-slate-600">Decision support only.</span> Confirm eligibility
              with the study team.{' '}
              <span className="whitespace-nowrap">
                <Link
                  href="/terms"
                  className="relative font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors after:absolute after:-inset-x-2 after:-inset-y-4 after:content-[''] hover:text-slate-900 hover:decoration-slate-500"
                >
                  Terms
                </Link>
                <span aria-hidden className="mx-2 text-slate-300">
                  ·
                </span>
                <a
                  href={mailto()}
                  className="relative font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors after:absolute after:-inset-x-2 after:-inset-y-4 after:content-[''] hover:text-slate-900 hover:decoration-slate-500"
                >
                  Contact
                </a>
              </span>
            </p>
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
