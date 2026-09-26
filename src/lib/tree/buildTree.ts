import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TreeData, TreeFilter, TrialDTO, DecisionNodeDTO } from '@/types';
import { centerBySlug } from '@/lib/locations';
import { hueFor, type CancerHue } from '@/lib/cancerColors';

// Pure (client-safe) transform: TreeData + filter -> laid-out React Flow graph.
//
// The tree's shape comes entirely from the curated data — no auto-grouping is
// added. What changes here is only how that shape is placed on screen.
//
// Two layouts live in this file, because the two views want genuinely
// different things:
//
//   • Stepped (the /explore + /admin browse experience) is never more than two
//     ranks deep — the node you are standing on, and the branches and trials
//     that hang directly off it. That is a hub with a list, not a graph, so it
//     gets a purpose-built grid that is planned against the real canvas size.
//     It fills the viewport instead of floating in the middle of it, and it
//     cannot overlap because nothing is inferred.
//   • Expanded (kiosk, search) really is a multi-level graph, so dagre still
//     lays that one out.
//
// Both paths obey the same invariant, and that invariant is what actually
// fixed the overlapping cards: every node carries an explicit width/height,
// and every node component renders at exactly that box (h-full + w-full +
// overflow-hidden, clamping its own text). So the box the layout reserves and
// the box the DOM paints are the same number by construction. The old code
// guessed a decision node's height from its label's character count, which was
// wrong far more often than it was right — hence cards sitting on top of one
// another.
//
// The second rule the stepped path obeys is a legibility floor (MIN_CARD_ZOOM).
// A level never answers "too many trials to fit" by shrinking the type: it shows
// fewer and reports the gap, and when the reader insists on all of them it hands
// the canvas an `overflow` flag instead — hold the cards at a readable size, and
// let them travel down the level rather than squinting at all of it.

export type Density = 'comfortable' | 'compact';

/**
 * Card geometry, one size for every card at a given density. A uniform cell is
 * what lets the stepped grid pack rows without measuring anything, and it is
 * why the decision cards and the trial cards line up instead of stair-stepping.
 * `rankGap` is the horizontal gap between levels in the dagre layout.
 */
export const CARD_METRICS: Record<
  Density,
  { w: number; h: number; minW: number; gapX: number; gapY: number; rankGap: number; maxCols: number }
> = {
  // `w` is the width a card is authored at; the stepped grid re-cuts it per
  // column count so a row always fits at the card's real type size (see
  // cellWidthFor). `minW` is the narrowest that re-cut may go before a column
  // count is simply ruled out — past it the title clamps too early to scan.
  comfortable: { w: 248, h: 132, minW: 200, gapX: 28, gapY: 24, rankGap: 104, maxCols: 5 },
  // The small card is deliberately no taller than the old trial card: the kiosk
  // draws the whole tree at once, so every extra pixel of card height is paid
  // for by the fit zooming further out. Two columns is the phone's ceiling —
  // a third would put three ~110px cards across a 360px screen.
  //
  // gapY is 18 rather than the 14 it started at. These cards carry a shadow and
  // a 2px hover lift, and at 14 two stacked cards read as one merged block even
  // though the layout had not actually overlapped them — the same complaint that
  // applied to the old dagre nodesep of 16, which this doubles as.
  //
  // minW 176 keeps a phone card at least ~154px inside, which is what a
  // "RECRUITING" pill plus "PHASE 1/2" and a two-pill count row need on one
  // line each. Narrower, they wrapped or ellipsized inside the fixed height.
  // In practice that means iPhone-width screens get one full-width column and
  // two columns start around 400px — fewer cards at once, each one readable.
  compact: { w: 200, h: 104, minW: 176, gapX: 16, gapY: 18, rankGap: 56, maxCols: 2 },
};

type Cell = { w: number; h: number; minW: number; gapX: number; gapY: number; maxCols: number };

/** Gap between the "you are here" card and the grid of next steps. */
const CONTEXT_GUTTER = 76;

/**
 * How far a card may widen to use the canvas, at any column count. A row of
 * 248px cards in a 1200px canvas is the "island floating in empty pixels" the
 * brief is about; a 1200px card is a banner. This is the middle.
 */
const SINGLE_COLUMN_STRETCH = 1.8;

/**
 * Slack React Flow leaves around the graph when it frames it. The grid planner
 * budgets for the same number, so the zoom it plans for is the zoom the canvas
 * actually lands on.
 */
export const FIT_PADDING = 0.06;

/**
 * Nothing is ever scaled up past this. A two-card level blown up to fill a 30"
 * monitor looks broken rather than intentional.
 */
export const MAX_FIT_ZOOM = 1.25;

/**
 * The smallest scale a card is ever drawn at: 1, its authored size. Rather than
 * shrink, a level shows fewer trials and says how many it held back — paging
 * beats illegible text.
 *
 * It used to be 0.8, which let a two-column phone level of 200px cards be drawn
 * at 0.82 — 10px type rendered at 8px, the exact "shrink it until it fits"
 * failure the brief names. Cards now get narrower for more columns instead of
 * smaller (cellWidthFor), so every accepted plan fits its row at full size and
 * nothing needs a fudge below 1.
 *
 * Exported because it is a floor the canvas has to honour too, not just a number
 * the planner consults: when a level cannot be framed at this scale the canvas
 * pins the zoom here and lets the reader move instead of zooming out further.
 */
export const MIN_CARD_ZOOM = 1;

/**
 * Whether a planned zoom clears the floor. A row cut by cellWidthFor fills its
 * budget exactly, so its width ratio is 1 in exact arithmetic but can come back
 * as 0.9999999 in floating point — and a strict `>=` would then reject every
 * multi-column arrangement. The tolerance is far below a visible pixel.
 */
const clearsFloor = (zoom: number) => zoom >= MIN_CARD_ZOOM - 1e-6;

/**
 * The card width that makes `cols` columns exactly fill `budget` CSS px at
 * zoom 1, within [minW, w × SINGLE_COLUMN_STRETCH].
 *
 * The planner and the renderer both call this, so the width a plan was scored
 * with is the width it is drawn at — the same by-construction agreement the
 * card heights have. Before, every multi-column row kept the authored 248px and
 * was then scaled to fit, which is what left a four-card desktop level at 58%
 * of the canvas width, and what shrank the type on phones.
 */
function cellWidthFor(cols: number, budget: number, cell: Cell): number {
  const share = (budget - (cols - 1) * cell.gapX) / cols;
  return Math.min(cell.w * SINGLE_COLUMN_STRETCH, Math.max(cell.minW, share));
}

/** Node type for the "+N more trials" tile, so callers can match on it. */
export const MORE_NODE_TYPE = 'more';

/** Canvas assumed before the container has been measured (first paint / SSR).
    The real size arrives a frame later and the level re-plans itself. */
const DEFAULT_CANVAS = { width: 1200, height: 660 };

/** Below this canvas width a phone-sized card is used instead of the full one. */
export const COMPACT_MAX_WIDTH = 700;

export function densityFor(width: number | null | undefined): Density {
  return typeof width === 'number' && width > 0 && width < COMPACT_MAX_WIDTH ? 'compact' : 'comfortable';
}

export type CanvasSize = { width: number; height: number };

export type DecisionNodeData = {
  label: string;
  kind: DecisionNodeDTO['kind'];
  trialCount?: number;
  recruitingCount?: number;
  /** Overrides the kind label shown on the node (e.g. "Phase" for a group). */
  tag?: string;
  /** Which cancer this node belongs to → its brand color. */
  hue?: CancerHue;
  density: Density;
  /** Renders as a real button (tab-focusable, Enter/Space drills in). */
  interactive: boolean;
  /** The "you are here" card the stepped view pins beside the next step. */
  context?: boolean;
};

export type TrialNodeData = {
  title: string;
  phase: string | null;
  nctId: string | null;
  pi: string | null;
  shorthand: string | null;
  statuses: { locationName: string; short: string; status: TrialDTO['locations'][number]['status'] }[];
  cohorts: { label: string; status: string }[];
  hue?: CancerHue;
  density: Density;
  interactive: boolean;
};

export type MoreTrialsNodeData = {
  hidden: number;
  total: number;
  density: Density;
  interactive: boolean;
};

/** What a layout pass produced, plus what it had to leave out. */
export type TreeLayout = {
  nodes: Node[];
  edges: Edge[];
  /** Trial cards actually drawn at this level… */
  shownTrials: number;
  /** …out of this many held here. The UI reports the gap rather than
      silently dropping studies. */
  totalTrials: number;
  /** Nothing to show beyond the "you are here" card — a real answer, not a
      loading state, so the canvas says so instead of sitting blank. */
  emptyLevel: boolean;
  /** This level does not fit the canvas at a legible scale, so the canvas must
      hold the cards at their readable size and let the reader move through them
      rather than zooming out until the type disappears. */
  overflow: boolean;
};

export type BuildOptions = {
  focusNodeId?: string | null;
  expandAll?: boolean;
  stepped?: boolean;
  density?: Density;
  /** Measured canvas, in CSS px. The stepped grid is planned to fill it. */
  canvas?: CanvasSize | null;
  /** The reader asked for every trial at this level, legibility be damned. */
  showAll?: boolean;
  /** False on the kiosk: cards render as static text, not buttons. */
  interactive?: boolean;
};

/** A renderable node — always a real curated decision node. */
type RNode = {
  id: string;
  label: string;
  kind: DecisionNodeDTO['kind'];
  parentId: string | null;
  /** Axis label for curated nodes (Stage / Histology / Line). */
  tag?: string | null;
};

function trialMatchesFilter(trial: TrialDTO, filter: TreeFilter): boolean {
  if (filter.locationSlug && !trial.locations.some((l) => l.locationSlug === filter.locationSlug)) {
    return false;
  }
  if (filter.pi) {
    const piHit =
      trial.principalInvestigator === filter.pi ||
      trial.locations.some((l) => l.piName === filter.pi);
    if (!piHit) return false;
  }
  const q = filter.search?.trim().toLowerCase();
  if (q) {
    const hay = [
      trial.title,
      trial.nctId,
      trial.shorthand,
      trial.protocolNumber,
      trial.principalInvestigator,
      ...trial.locations.map((l) => l.piName ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function buildTree(data: TreeData, filter: TreeFilter = {}, opts: BuildOptions = {}): TreeLayout {
  const searching = !!filter.search?.trim();
  const expandAll = !!opts.expandAll;
  const stepped = !!opts.stepped;
  const density: Density = opts.density ?? 'comfortable';
  const interactive = opts.interactive !== false;
  const cell = CARD_METRICS[density];

  const byId = new Map(data.decisionNodes.map((n) => [n.id, n] as const));
  // Ignore a stale id (e.g. after the curated data is reloaded).
  const rawFocus = opts.focusNodeId ?? null;
  const focusNodeId = rawFocus && byId.has(rawFocus) ? rawFocus : null;
  const childDecisions = new Map<string, string[]>();
  for (const n of data.decisionNodes) {
    if (!n.parentId) continue;
    (childDecisions.get(n.parentId) ?? childDecisions.set(n.parentId, []).get(n.parentId)!).push(n.id);
  }

  // Apply data filters.
  let trials = data.trials.filter((t) => trialMatchesFilter(t, filter));
  if (filter.diseaseLabel) {
    trials = trials.filter((t) => rootLabel(t.decisionNodeId, byId) === filter.diseaseLabel);
  }

  const groupByNode = (ts: TrialDTO[]) => {
    const m = new Map<string, TrialDTO[]>();
    for (const t of ts) (m.get(t.decisionNodeId) ?? m.set(t.decisionNodeId, []).get(t.decisionNodeId)!).push(t);
    return m;
  };
  const ancestorsOf = (keys: Iterable<string>) => {
    const need = new Set<string>();
    for (const k of keys) {
      let cur: DecisionNodeDTO | undefined = byId.get(k);
      let g = 0;
      while (cur && g++ < 12) {
        need.add(cur.id);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
    }
    return need;
  };

  // Decide the renderable node set, trials-per-node, and whether to draw grids.
  const rnodes: RNode[] = [];
  let trialsByNode = new Map<string, TrialDTO[]>();
  let collapse = true;

  // The stepped view is only ever "this node + its next step", so it is
  // captured separately from the generic node list the dagre path consumes.
  let stepContext: RNode | null = null;
  const stepBranches: RNode[] = [];
  let stepTrials: TrialDTO[] = [];

  const pushReal = (ids: Iterable<string>) => {
    for (const id of ids) {
      const n = byId.get(id);
      if (n) rnodes.push({ id, label: n.label, kind: n.kind, parentId: n.parentId, tag: n.tag });
    }
  };

  // Empty branches are hidden only when actively filtering (by center/PI), so a
  // filter still narrows the view — but a hand-authored skeleton with no trials
  // yet always renders its structure.
  const filtering = !!(filter.locationSlug || filter.pi);
  const useGrid = stepped && !searching && !expandAll;

  if (useGrid) {
    // Stepped map: show ONE level at a time — the current node, its immediate
    // branches as counts, and any trials attached directly to it as cards.
    const directByNode = new Map<string, TrialDTO[]>();
    for (const t of trials) {
      (directByNode.get(t.decisionNodeId) ?? directByNode.set(t.decisionNodeId, []).get(t.decisionNodeId)!).push(t);
    }
    const subCache = new Map<string, TrialDTO[]>();
    const subtreeTrials = (id: string): TrialDTO[] => {
      const hit = subCache.get(id);
      if (hit) return hit;
      const all = [
        ...(directByNode.get(id) ?? []),
        ...(childDecisions.get(id) ?? []).flatMap((c) => subtreeTrials(c)),
      ];
      subCache.set(id, all);
      return all;
    };

    // If a cancer type is selected in the filter, treat it as the entry point
    // (its states are the first level) so you skip the single-card step.
    const diseaseNodeId = filter.diseaseLabel
      ? (data.decisionNodes.find((n) => !n.parentId && n.label === filter.diseaseLabel)?.id ?? null)
      : null;
    const eff = focusNodeId ?? diseaseNodeId;

    if (eff) {
      // A node → show it, its branches (as counts), and any trials that sit
      // directly on it (as cards) — exactly as the clinician's tree defines it.
      const node = byId.get(eff)!;
      const ctx: RNode = { id: node.id, label: node.label, kind: node.kind, parentId: null, tag: node.tag };
      rnodes.push(ctx);
      stepContext = ctx;
      trialsByNode.set(node.id, subtreeTrials(node.id));
      // Sub-branches that are further decision nodes (e.g. biomarkers)…
      for (const id of childDecisions.get(eff) ?? []) {
        const k = byId.get(id)!;
        if (filtering && subtreeTrials(k.id).length === 0) continue;
        const branch: RNode = { id: k.id, label: k.label, kind: k.kind, parentId: node.id, tag: k.tag };
        rnodes.push(branch);
        stepBranches.push(branch);
        trialsByNode.set(k.id, subtreeTrials(k.id));
      }
      // …plus the trials that sit directly on this node, as cards. A node can
      // hold both (RCC "Non-metastatic" carries one trial of its own alongside
      // its histology branches), so the next level is a mixed set and the grid
      // places the two kinds of card in one run of equal cells.
      stepTrials = directByNode.get(eff) ?? [];
      collapse = true;
    } else {
      // Top level → the cancer-type choices.
      for (const r of data.decisionNodes.filter((n) => !n.parentId)) {
        if (filtering && subtreeTrials(r.id).length === 0) continue;
        const root: RNode = { id: r.id, label: r.label, kind: r.kind, parentId: null, tag: r.tag };
        rnodes.push(root);
        stepBranches.push(root);
        trialsByNode.set(r.id, subtreeTrials(r.id));
      }
      collapse = true;
    }
  } else if (focusNodeId && !searching && !expandAll) {
    const subtree = descendants(focusNodeId, childDecisions);
    const focusTrials = trials.filter((t) => subtree.has(t.decisionNodeId));
    const terminal = !(childDecisions.get(focusNodeId)?.length);

    if (terminal) {
      // Terminal branch: its trials hang directly off it as cards.
      collapse = false;
      pushReal(ancestorsOf([focusNodeId])); // path root → focus (context)
      trialsByNode = new Map([[focusNodeId, focusTrials]]);
    } else {
      // Non-terminal branch: show the next grouping level as counts.
      collapse = true;
      trialsByNode = groupByNode(focusTrials);
      pushReal(ancestorsOf([...trialsByNode.keys(), focusNodeId]));
    }
  } else {
    // Overview (counts) or search/kiosk (expanded trial grids).
    collapse = !(searching || expandAll);
    trialsByNode = groupByNode(trials);
    pushReal(ancestorsOf(trialsByNode.keys()));
  }

  const locSlug = filter.locationSlug ?? null;
  const isRecruiting = (t: TrialDTO) =>
    t.locations.some((l) => (!locSlug || l.locationSlug === locSlug) && l.status === 'RECRUITING');
  const recruitingUnder = (arr: TrialDTO[]) => arr.filter(isRecruiting).length;

  // /api/tree returns trials in whatever order Postgres hands back, so without
  // this the same level could re-order itself between refreshes. Recruiting
  // first is also the order that matters when a level has to page: an open
  // study must never be the one hidden behind "+N more".
  const displayOrder = (a: TrialDTO, b: TrialDTO) => {
    const ra = isRecruiting(a) ? 0 : 1;
    const rb = isRecruiting(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return (a.shorthand ?? a.title).localeCompare(b.shorthand ?? b.title);
  };

  const decisionData = (n: RNode, extra: { withCount: boolean; context?: boolean }): DecisionNodeData => {
    const held = trialsByNode.get(n.id) ?? [];
    const d: DecisionNodeData = {
      label: n.label,
      kind: n.kind,
      hue: hueFor(rootLabel(n.id, byId)),
      density,
      interactive: interactive && !extra.context,
    };
    if (n.tag) d.tag = n.tag;
    if (extra.withCount && held.length) {
      d.trialCount = held.length;
      d.recruitingCount = recruitingUnder(held);
    }
    if (extra.context) d.context = true;
    return d;
  };

  const trialData = (t: TrialDTO): TrialNodeData => ({
    title: t.title,
    phase: t.phase,
    nctId: t.nctId,
    pi: t.principalInvestigator,
    shorthand: t.shorthand,
    statuses: (locSlug ? t.locations.filter((l) => l.locationSlug === locSlug) : t.locations).map((l) => ({
      locationName: l.locationName,
      short: centerBySlug(l.locationSlug)?.shortName ?? l.locationName,
      status: l.status,
    })),
    cohorts: t.cohorts.map((c) => ({ label: c.label, status: c.status })),
    hue: hueFor(rootLabel(t.decisionNodeId, byId)),
    density,
    interactive,
  });

  if (useGrid) {
    return gridLayout({
      context: stepContext,
      branches: stepBranches,
      trials: [...stepTrials].sort(displayOrder),
      cell,
      density,
      canvas: opts.canvas ?? null,
      showAll: !!opts.showAll,
      interactive,
      decisionData,
      trialData,
    });
  }

  // --- Layout: a real left-to-right tree (dagre). Trials are their own leaf
  //     nodes connected by branches — not packed into a grid. ---
  const rnodeIds = new Set(rnodes.map((r) => r.id));
  // A collapsed view reports its trials as counts on the branch; an expanded one
  // (kiosk, search, a terminal branch) draws every held trial as its own card.
  const cards = collapse ? new Map<string, TrialDTO[]>() : trialsByNode;

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    // nodesep is the gap WITHIN a rank; at 16 it was far tighter than the
    // shadow and hover-lift these cards carry, so neighbours looked merged
    // even when dagre had not actually overlapped them.
    nodesep: cell.gapY,
    edgesep: 12,
    ranksep: cell.rankGap,
    marginx: 24,
    marginy: 24,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  // Decision / group nodes + their branch edges.
  for (const n of rnodes) {
    g.setNode(n.id, { width: cell.w, height: cell.h });
    if (n.parentId && rnodeIds.has(n.parentId)) {
      g.setEdge(n.parentId, n.id);
      rfEdges.push({ id: `e-${n.parentId}-${n.id}`, source: n.parentId, target: n.id, type: 'smoothstep' });
    }
  }

  // Trial leaf nodes — each branches off the node it belongs to.
  let shownTrials = 0;
  const orderedCards = new Map<string, TrialDTO[]>();
  for (const [holderId, ts] of cards) {
    const sorted = [...ts].sort(displayOrder);
    orderedCards.set(holderId, sorted);
    for (const t of sorted) {
      const tid = `trial-${t.id}`;
      g.setNode(tid, { width: cell.w, height: cell.h });
      g.setEdge(holderId, tid);
      rfEdges.push({ id: `e-${holderId}-${tid}`, source: holderId, target: tid, type: 'smoothstep' });
      shownTrials += 1;
    }
  }

  dagre.layout(g);

  for (const n of rnodes) {
    const p = g.node(n.id);
    const held = trialsByNode.get(n.id) ?? [];
    rfNodes.push(
      card({
        id: n.id,
        type: 'decision',
        x: p.x - cell.w / 2,
        y: p.y - cell.h / 2,
        cell,
        data: decisionData(n, { withCount: held.length > 0 && collapse }),
        interactive,
      }),
    );
  }

  for (const [, ts] of orderedCards) {
    for (const t of ts) {
      const p = g.node(`trial-${t.id}`);
      rfNodes.push(
        card({
          id: `trial-${t.id}`,
          type: 'trial',
          x: p.x - cell.w / 2,
          y: p.y - cell.h / 2,
          cell,
          data: trialData(t),
          interactive,
        }),
      );
    }
  }

  // The kiosk has to show every branch at once, however far out that lands — a
  // legibility floor there would crop part of the tree on a display nobody can
  // touch. Search does not: a 3,900px column of matches framed at 0.2 is a grid
  // of grey smudges.
  //
  // But a search graph reads left to right, with the matches in the right-most
  // rank, and an overflowing level is pinned at its top-left. So pinning is only
  // safe when every rank fits ACROSS at full size and just the height runs over
  // — then the matches are on screen and the reader scrolls down them. A graph
  // too wide for that is framed whole, as before; pinning it would show the
  // ancestor chain and leave the actual matches off the right edge.
  let overflow = false;
  if (!expandAll && opts.canvas && rfNodes.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of rfNodes) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + cell.w);
      maxY = Math.max(maxY, n.position.y + cell.h);
    }
    const slack = 1 + FIT_PADDING;
    const fitW = opts.canvas.width / slack / (maxX - minX);
    const fitH = opts.canvas.height / slack / (maxY - minY);
    overflow = clearsFloor(fitW) && !clearsFloor(fitH);
  }

  return {
    nodes: rfNodes,
    edges: rfEdges,
    shownTrials,
    totalTrials: shownTrials,
    emptyLevel: rfNodes.length === 0,
    overflow,
  };
}

// ---------------------------------------------------------------------------
// The stepped grid
// ---------------------------------------------------------------------------

/**
 * Chooses how many columns the next level should use, and how many trial cards
 * will actually fit.
 *
 * `fixed` cells are branches — structure is never hidden, so they are always
 * placed. `flex` cells are trial cards, which may be paged. For each candidate
 * column count we work out the zoom the canvas would settle at; the most
 * readable arrangement wins, and ties go to fewer columns (a 3-wide grid reads
 * better than a 5-wide one at the same scale).
 *
 * One column is preferred outright whenever the whole level fits in one, and
 * that is not just taste: branch lines can only be drawn down a single column
 * (see gridLayout), so a level that fits in one gets to keep them. Wide levels
 * are lists of trials rather than forks in the tree, and lose little by being
 * laid out as a block.
 */
function planGrid(
  fixed: number,
  flex: number,
  cell: Cell,
  area: { width: number; height: number },
  allowTruncate: boolean,
  preferSingleColumn: boolean,
): { cols: number; shownFlex: number; hidden: number } {
  const zoomAt = (cells: number, cols: number) => {
    const rows = Math.max(1, Math.ceil(cells / cols));
    const w = cols * cellWidthFor(cols, area.width, cell) + (cols - 1) * cell.gapX;
    const h = rows * cell.h + (rows - 1) * cell.gapY;
    return Math.min(area.width / w, area.height / h, MAX_FIT_ZOOM);
  };
  const zoomFor = (cells: number) => {
    if (cells <= 0) return { cols: 1, zoom: MAX_FIT_ZOOM };
    let best = { cols: 1, zoom: -1 };
    for (let cols = 1; cols <= Math.min(cell.maxCols, cells); cols++) {
      const zoom = zoomAt(cells, cols);
      if (zoom > best.zoom + 1e-6) best = { cols, zoom };
    }
    return best;
  };

  const total = fixed + flex;
  if (preferSingleColumn && total > 0 && clearsFloor(zoomAt(total, 1))) {
    return { cols: 1, shownFlex: flex, hidden: 0 };
  }

  let shownFlex = flex;
  let plan = zoomFor(total);
  if (allowTruncate && flex > 0) {
    // Each step down frees a cell but spends one on the "+N more" tile, so the
    // loop is only worth running while there is more than one trial to show.
    while (!clearsFloor(plan.zoom) && shownFlex > 1) {
      shownFlex -= 1;
      plan = zoomFor(fixed + shownFlex + 1);
    }
  }
  return { cols: plan.cols, shownFlex, hidden: flex - shownFlex };
}

/**
 * The widest arrangement whose ROW still fits the canvas at the legibility floor.
 *
 * Used only when a level has given up on being framed whole — then the one thing
 * that must still fit is a row, because a grid the reader has to drag sideways
 * as well as down stops reading as a list. The grid runs off the bottom instead,
 * which is the direction a reader already expects to travel.
 */
function colsForWidth(cells: number, cell: Cell, areaWidth: number): number {
  // The drawn zoom is the floor, so the row has areaWidth / floor to fill; a
  // column count is possible while its cards can be cut no narrower than minW.
  const budget = areaWidth / MIN_CARD_ZOOM;
  let cols = 1;
  for (let c = 2; c <= Math.min(cell.maxCols, Math.max(1, cells)); c++) {
    if (c * cell.minW + (c - 1) * cell.gapX > budget) break;
    cols = c;
  }
  return cols;
}

function gridLayout(args: {
  context: RNode | null;
  branches: RNode[];
  trials: TrialDTO[];
  cell: Cell;
  density: Density;
  canvas: CanvasSize | null;
  showAll: boolean;
  interactive: boolean;
  decisionData: (n: RNode, extra: { withCount: boolean; context?: boolean }) => DecisionNodeData;
  trialData: (t: TrialDTO) => TrialNodeData;
}): TreeLayout {
  const { branches, trials, cell, density, canvas, showAll, interactive } = args;

  const slack = 1 + FIT_PADDING;
  const width = canvas?.width ?? DEFAULT_CANVAS.width;
  const height = canvas?.height ?? DEFAULT_CANVAS.height;
  const areaFor = (gutter: number) => ({
    width: Math.max(cell.w, width / slack - gutter),
    height: Math.max(cell.h, height / slack),
  });

  // A phone has no width to give to a "you are here" card beside the level —
  // pinning one costs a third of a 360px screen. The header's Back button and
  // current-step label already say where the reader is standing, so the small
  // layout spends the whole width on the step itself.
  let context = density === 'compact' ? null : args.context;
  let gutter = context ? cell.w + CONTEXT_GUTTER : 0;

  /** The zoom an arrangement would settle at, inside the area gutter `g` leaves. */
  const framed = (nCols: number, nCells: number, g: number) => {
    if (nCells <= 0) return MAX_FIT_ZOOM;
    const a = areaFor(g);
    const nRows = Math.max(1, Math.ceil(nCells / nCols));
    const w = nCols * cellWidthFor(nCols, a.width, cell) + (nCols - 1) * cell.gapX;
    const h = nRows * cell.h + (nRows - 1) * cell.gapY;
    return Math.min(a.width / w, a.height / h);
  };
  const cellsIn = (p: { shownFlex: number; hidden: number }) =>
    branches.length + Math.min(p.shownFlex, trials.length) + (p.hidden > 0 ? 1 : 0);

  // Planned twice, on purpose. The pinned card exists to anchor the branch
  // lines, and lines can only be drawn down a single column — so once a level
  // goes wide, or has to hold trials back to stay readable, the card is earning
  // nothing while costing a third of the width. Re-planning without it is
  // frequently the difference between a level showing every trial and a level
  // paging them. The second pass can only ever show more: it has strictly more
  // room and the same column ceiling.
  //
  // The third trigger is what keeps the card from being stranded: it centres
  // itself on the grid, so on a grid taller than the canvas — which is read from
  // the top — it would sit somewhere below the fold, anchoring lines to cards
  // nobody can see. Dropping it there also guarantees `drawEdges` is false
  // whenever the level overflows.
  let plan = planGrid(branches.length, trials.length, cell, areaFor(gutter), !showAll, !!context);
  if (
    context &&
    (plan.cols > 1 || plan.hidden > 0 || !clearsFloor(framed(plan.cols, cellsIn(plan), gutter)))
  ) {
    context = null;
    gutter = 0;
    plan = planGrid(branches.length, trials.length, cell, areaFor(gutter), !showAll, false);
  }
  const area = areaFor(gutter);
  let { shownFlex, hidden } = plan;
  let cells = branches.length + Math.min(shownFlex, trials.length) + (hidden > 0 ? 1 : 0);

  // Asking for every trial at this level ("Show all 15") used to be answered by
  // zooming out until they all fit — which is the illegible-text failure paging
  // exists to avoid, and worse: the canvas only unlocks panning once a fit has
  // bottomed out at its absolute floor, so at 0.43 the reader could neither read
  // the cards nor move to them. A dead end.
  //
  // So when a set genuinely cannot be framed at a readable size, the layout
  // stops trying to frame it: the row is planned to the canvas width, the grid
  // runs off the bottom, and `overflow` tells the canvas to pin the zoom at the
  // legibility floor and let the reader travel down it. Branches can land here
  // too, on a very short canvas — structure is never paged away, so this is also
  // what keeps a many-branch level reachable instead of merely small.
  const overflow = cells > 0 && !clearsFloor(framed(plan.cols, cells, gutter));

  // Paging buys nothing once a level has given up on being framed, so it is
  // undone here. A level whose BRANCHES alone overrun the canvas lands in exactly
  // that state — structure is never paged away, so the truncation loop keeps
  // spending trial slots it can never win back, and would leave the reader
  // looking at one study plus a "+N more" tile on a level that still overflows.
  // The cards are drawn at the legibility floor either way, so the tile would
  // cost a tap and gain nothing. Un-truncating only makes the grid taller, which
  // is the direction an overflowing level already travels.
  if (overflow && hidden > 0) {
    shownFlex = trials.length;
    hidden = 0;
    cells = branches.length + trials.length;
  }

  const shownTrials = trials.slice(0, shownFlex);
  const cols = overflow ? colsForWidth(cells, cell, area.width) : plan.cols;
  const rows = Math.max(1, Math.ceil(cells / cols));

  // Every arrangement is cut to the width it has — one column or five — using
  // the same function the planner scored it with, so the plan and the drawing
  // agree. Only stretching a lone column used to leave any multi-column level
  // floating in the middle of the canvas. An overflowing level is drawn at the
  // floor, so its budget is the floor's rather than the raw area's.
  const cellW = cellWidthFor(cols, area.width / (overflow ? MIN_CARD_ZOOM : 1), cell);
  const gridCell = { w: cellW, h: cell.h };
  const gridW = cols * cellW + (cols - 1) * cell.gapX;
  const gridH = rows * cell.h + (rows - 1) * cell.gapY;

  // A half-empty last row centred under the ones above reads as a deliberate
  // block; left-aligned it reads as something that failed to load.
  const rowOffset = (row: number) => {
    const inRow = Math.min(cols, cells - row * cols);
    return (gridW - (inRow * cellW + (inRow - 1) * cell.gapX)) / 2;
  };
  const place = (index: number) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      x: gutter + rowOffset(row) + col * (cellW + cell.gapX),
      y: row * (cell.h + cell.gapY),
    };
  };

  // With nothing under it the pinned card would be anchoring lines to an empty
  // grid, and the canvas's own "nothing to show here" message paints straight
  // over it — so an empty level is just the message.
  if (cells === 0) context = null;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (context) {
    nodes.push(
      card({
        id: context.id,
        type: 'decision',
        x: 0,
        y: (gridH - cell.h) / 2,
        cell,
        data: args.decisionData(context, { withCount: true, context: true }),
        interactive: false,
      }),
    );
  }

  // Branch lines are drawn only down a single column. Past that the grid wraps,
  // and a line reaching a second-column card has to run straight through a
  // first-column one — which reads as a relationship that does not exist. On a
  // clinical tree that is worse than no line at all, so a wide level is laid out
  // as a block of choices and leaves the hierarchy to the breadcrumb.
  // (An overflowing level has already dropped `context`, so this is false there.)
  const drawEdges = !!context && cols === 1;
  const connect = (targetId: string) => {
    if (!drawEdges || !context) return;
    edges.push({
      id: `e-${context.id}-${targetId}`,
      source: context.id,
      target: targetId,
      type: 'smoothstep',
    });
  };

  let index = 0;
  for (const b of branches) {
    const p = place(index++);
    nodes.push(
      card({
        id: b.id,
        type: 'decision',
        x: p.x,
        y: p.y,
        cell: gridCell,
        data: args.decisionData(b, { withCount: true }),
        interactive,
      }),
    );
    connect(b.id);
  }
  for (const t of shownTrials) {
    const p = place(index++);
    const id = `trial-${t.id}`;
    nodes.push(
      card({ id, type: 'trial', x: p.x, y: p.y, cell: gridCell, data: args.trialData(t), interactive }),
    );
    connect(id);
  }
  if (hidden > 0) {
    const p = place(index++);
    const data: MoreTrialsNodeData = { hidden, total: trials.length, density, interactive };
    nodes.push(
      card({ id: 'more-trials', type: MORE_NODE_TYPE, x: p.x, y: p.y, cell: gridCell, data, interactive }),
    );
    connect('more-trials');
  }

  return {
    nodes,
    edges,
    shownTrials: shownTrials.length,
    totalTrials: trials.length,
    emptyLevel: cells === 0,
    overflow,
  };
}

/**
 * The one place a node is turned into a React Flow node. Width and height are
 * written to the node AND to its inline style so React Flow never has to
 * measure the DOM to find out how big the card is — which is the whole reason
 * the layout and the render can no longer disagree.
 */
function card(args: {
  id: string;
  type: string;
  x: number;
  y: number;
  cell: { w: number; h: number };
  data: DecisionNodeData | TrialNodeData | MoreTrialsNodeData;
  interactive: boolean;
}): Node {
  return {
    id: args.id,
    type: args.type,
    position: { x: args.x, y: args.y },
    data: args.data,
    width: args.cell.w,
    height: args.cell.h,
    style: { width: args.cell.w, height: args.cell.h },
    draggable: false,
    selectable: args.interactive,
    connectable: false,
  };
}

function descendants(rootId: string, childMap: Map<string, string[]>): Set<string> {
  const s = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (s.has(id)) continue;
    s.add(id);
    for (const c of childMap.get(id) ?? []) stack.push(c);
  }
  return s;
}

function rootLabel(nodeId: string, byId: Map<string, DecisionNodeDTO>): string | null {
  let cur = byId.get(nodeId);
  let root = cur;
  let g = 0;
  while (cur && g++ < 12) {
    root = cur;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return root?.label ?? null;
}
