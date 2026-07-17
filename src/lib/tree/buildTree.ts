import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TreeData, TreeFilter, TrialDTO, DecisionNodeDTO } from '@/types';
import { centerBySlug } from '@/lib/locations';
import { treatmentClass, CLASS_ORDER } from '@/lib/treatmentClass';

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
  /** Overrides the kind label shown on the node (e.g. "Phase" for a group). */
  tag?: string;
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
  opts: { focusNodeId?: string | null; expandAll?: boolean; stepped?: boolean } = {},
) {
  const searching = !!filter.search?.trim();
  const expandAll = !!opts.expandAll;
  const stepped = !!opts.stepped;

  const byId = new Map(data.decisionNodes.map((n) => [n.id, n] as const));
  // Keep synthetic "grp:" ids; ignore a stale real id (e.g. after a re-import).
  const rawFocus = opts.focusNodeId ?? null;
  const focusNodeId = rawFocus && (rawFocus.startsWith('grp:') || byId.has(rawFocus)) ? rawFocus : null;
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

  if (stepped && !searching && !expandAll) {
    // Stepped map: show ONE level at a time — the current node and its immediate
    // children as counts (or, at a treatment-approach group, the trials).
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

    if (eff && eff.startsWith('grp:')) {
      // Treatment-approach group → show it + its trials.
      const parts = eff.split(':');
      const stateId = parts[1];
      const cls = parts.slice(2).join(':');
      const ts = (directByNode.get(stateId) ?? []).filter((t) => treatmentClass(t) === cls);
      rnodes.push({ id: eff, label: cls, kind: 'LINE_OF_THERAPY', parentId: null, synthetic: true });
      trialsByNode.set(eff, ts);
      collapse = false;
    } else if (eff) {
      // A cancer / state / biomarker node → show it + its next level (counts).
      const node = byId.get(eff)!;
      rnodes.push({ id: node.id, label: node.label, kind: node.kind, parentId: null });
      trialsByNode.set(node.id, subtreeTrials(node.id));
      // Sub-branches that are further decision nodes (e.g. biomarkers)…
      for (const id of childDecisions.get(eff) ?? []) {
        const k = byId.get(id)!;
        if (subtreeTrials(k.id).length === 0) continue;
        rnodes.push({ id: k.id, label: k.label, kind: k.kind, parentId: node.id });
        trialsByNode.set(k.id, subtreeTrials(k.id));
      }
      // …plus treatment-approach groups for trials sitting directly on this node.
      const own = directByNode.get(eff) ?? [];
      if (own.length) {
        const groups = new Map<string, TrialDTO[]>();
        for (const t of own) {
          const c = treatmentClass(t);
          (groups.get(c) ?? groups.set(c, []).get(c)!).push(t);
        }
        for (const c of CLASS_ORDER) {
          const ts = groups.get(c);
          if (!ts?.length) continue;
          rnodes.push({ id: `grp:${eff}:${c}`, label: c, kind: 'LINE_OF_THERAPY', parentId: node.id, synthetic: true });
          trialsByNode.set(`grp:${eff}:${c}`, ts);
        }
      }
      collapse = true;
    } else {
      // Top level → the cancer-type choices.
      for (const r of data.decisionNodes.filter((n) => !n.parentId)) {
        if (subtreeTrials(r.id).length === 0) continue;
        rnodes.push({ id: r.id, label: r.label, kind: r.kind, parentId: null });
        trialsByNode.set(r.id, subtreeTrials(r.id));
      }
      collapse = true;
    }
  } else if (focusNodeId && !searching && !expandAll) {
    const subtree = descendants(focusNodeId, childDecisions);
    const focusTrials = trials.filter((t) => subtree.has(t.decisionNodeId));
    const terminal = !(childDecisions.get(focusNodeId)?.length);

    if (terminal) {
      // Terminal branch: group its trials by treatment approach into a sub-tree.
      collapse = false;
      pushReal(ancestorsOf([focusNodeId])); // path root → focus (context)
      const groups = new Map<string, TrialDTO[]>();
      for (const t of focusTrials) {
        const b = treatmentClass(t);
        (groups.get(b) ?? groups.set(b, []).get(b)!).push(t);
      }
      for (const b of CLASS_ORDER) {
        const ts = groups.get(b);
        if (!ts?.length) continue;
        const sid = `grp:${focusNodeId}:${b}`;
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
    const showCount = !!held?.length && (collapse || !!n.synthetic);
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
    if (n.synthetic) headerData.tag = 'Approach';
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
