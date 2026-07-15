import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TreeData, TreeFilter, TrialDTO, DecisionNodeDTO } from '@/types';
import { centerBySlug } from '@/lib/locations';

// Pure (client-safe) transform: TreeData + filter -> laid-out React Flow graph.
//
// Rendering rules:
//   • Overview (default): decision nodes only, each leaf shows a
//     "N trials · M recruiting" badge — the whole map fits one screen.
//   • Drill into a branch: shows the next level of grouping (counts) until you
//     reach a "terminal" node, whose trials are grouped by PHASE into a small
//     sub-tree (Phase III–IV / II / I) with the trial cards under each.
//   • expandAll (kiosk) / search: shows the actual trial cards in a grid.

export type DecisionNodeData = {
  label: string;
  kind: DecisionNodeDTO['kind'];
  trialCount?: number;
  recruitingCount?: number;
};

export type TrialNodeData = {
  title: string;
  phase: string | null;
  nctId: string | null;
  pi: string | null;
  shorthand: string | null;
  statuses: { locationName: string; short: string; status: TrialDTO['locations'][number]['status'] }[];
  cohorts: { label: string; status: string }[];
  compact?: boolean;
};

const NODE_W = 220;
const TRIAL_W = 158;
const TRIAL_H = 104; // fixed card height

const PHASE_ORDER = ['Phase III–IV', 'Phase II', 'Phase I / Early', 'Other / NA'];
function phaseBucket(phase: string | null): string {
  if (!phase) return 'Other / NA';
  if (/IV|III/i.test(phase)) return 'Phase III–IV';
  if (/II/i.test(phase)) return 'Phase II';
  if (/\bI\b|early/i.test(phase)) return 'Phase I / Early';
  return 'Other / NA';
}

/** A renderable node: a real decision node, or a synthetic phase group. */
type RNode = {
  id: string;
  label: string;
  kind: DecisionNodeDTO['kind'];
  parentId: string | null;
  synthetic?: boolean;
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

export function buildTree(
  data: TreeData,
  filter: TreeFilter = {},
  opts: { focusNodeId?: string | null; expandAll?: boolean } = {},
) {
  const searching = !!filter.search?.trim();
  const expandAll = !!opts.expandAll;

  const byId = new Map(data.decisionNodes.map((n) => [n.id, n] as const));
  // Ignore a stale focus id (e.g. after a re-import regenerated node ids).
  const focusNodeId = opts.focusNodeId && byId.has(opts.focusNodeId) ? opts.focusNodeId : null;
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
  let rnodes: RNode[] = [];
  let trialsByNode = new Map<string, TrialDTO[]>();
  let collapse = true;

  const pushReal = (ids: Iterable<string>) => {
    for (const id of ids) {
      const n = byId.get(id);
      if (n) rnodes.push({ id, label: n.label, kind: n.kind, parentId: n.parentId });
    }
  };

  if (focusNodeId && !searching && !expandAll) {
    const subtree = descendants(focusNodeId, childDecisions);
    const focusTrials = trials.filter((t) => subtree.has(t.decisionNodeId));
    const terminal = !(childDecisions.get(focusNodeId)?.length);

    if (terminal) {
      // Terminal branch: phase-group its trials into a small sub-tree.
      collapse = false;
      pushReal(ancestorsOf([focusNodeId])); // path root → focus (context)
      const groups = new Map<string, TrialDTO[]>();
      for (const t of focusTrials) {
        const b = phaseBucket(t.phase);
        (groups.get(b) ?? groups.set(b, []).get(b)!).push(t);
      }
      for (const b of PHASE_ORDER) {
        const ts = groups.get(b);
        if (!ts?.length) continue;
        const sid = `phase:${focusNodeId}:${b}`;
        rnodes.push({ id: sid, label: b, kind: 'LINE_OF_THERAPY', parentId: focusNodeId, synthetic: true });
        trialsByNode.set(sid, ts);
      }
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

  const rnodeIds = new Set(rnodes.map((r) => r.id));
  const locSlug = filter.locationSlug ?? null;
  const recruitingUnder = (arr: TrialDTO[]) =>
    arr.filter((t) =>
      t.locations.some((l) => (!locSlug || l.locationSlug === locSlug) && l.status === 'RECRUITING'),
    ).length;

  // --- Layout: a real left-to-right tree (dagre). Trials are their own leaf
  //     nodes connected by branches — not packed into a grid. ---
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 16, ranksep: 70, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  // Decision / group nodes + their branch edges.
  for (const n of rnodes) {
    const held = trialsByNode.get(n.id);
    const showCount = !!held?.length && (collapse || n.synthetic);
    g.setNode(n.id, { width: NODE_W, height: decisionHeight(n.label, showCount) });
    if (n.parentId && rnodeIds.has(n.parentId)) {
      g.setEdge(n.parentId, n.id);
      rfEdges.push({ id: `e-${n.parentId}-${n.id}`, source: n.parentId, target: n.id, type: 'smoothstep' });
    }
  }

  // Trial leaf nodes (only when expanded) — each branches off its group.
  if (!collapse) {
    for (const [holderId, ts] of trialsByNode) {
      for (const t of ts) {
        const tid = `trial-${t.id}`;
        g.setNode(tid, { width: TRIAL_W, height: TRIAL_H });
        g.setEdge(holderId, tid);
        rfEdges.push({ id: `e-${holderId}-${tid}`, source: holderId, target: tid, type: 'smoothstep' });
      }
    }
  }

  dagre.layout(g);

  // Emit decision / group nodes.
  for (const n of rnodes) {
    const p = g.node(n.id);
    const held = trialsByNode.get(n.id) ?? [];
    const headerData: DecisionNodeData = { label: n.label, kind: n.kind };
    if (held.length && (collapse || n.synthetic)) {
      headerData.trialCount = held.length;
      headerData.recruitingCount = recruitingUnder(held);
    }
    rfNodes.push({
      id: n.id,
      type: 'decision',
      position: { x: p.x - p.width / 2, y: p.y - p.height / 2 },
      data: headerData,
      style: { width: NODE_W },
    });
  }

  // Emit trial leaf nodes.
  if (!collapse) {
    for (const [, ts] of trialsByNode) {
      for (const t of ts) {
        const p = g.node(`trial-${t.id}`);
        const statuses = (locSlug ? t.locations.filter((l) => l.locationSlug === locSlug) : t.locations).map(
          (l) => ({
            locationName: l.locationName,
            short: centerBySlug(l.locationSlug)?.shortName ?? l.locationName,
            status: l.status,
          }),
        );
        rfNodes.push({
          id: `trial-${t.id}`,
          type: 'trial',
          position: { x: p.x - TRIAL_W / 2, y: p.y - TRIAL_H / 2 },
          data: {
            title: t.title,
            phase: t.phase,
            nctId: t.nctId,
            pi: t.principalInvestigator,
            shorthand: t.shorthand,
            statuses,
            cohorts: t.cohorts.map((c) => ({ label: c.label, status: c.status })),
            compact: true,
          } satisfies TrialNodeData,
          style: { width: TRIAL_W, height: TRIAL_H },
          draggable: false,
          selectable: true,
        });
      }
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}

function decisionHeight(label: string, hasCount: boolean): number {
  const lines = Math.max(1, Math.ceil(label.length / 18));
  return 46 + lines * 22 + (hasCount ? 30 : 0);
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
