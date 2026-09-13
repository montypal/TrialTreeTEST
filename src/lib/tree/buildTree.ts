import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TreeData, TreeFilter, TrialDTO, DecisionNodeDTO } from '@/types';
import { centerBySlug } from '@/lib/locations';
import { hueFor, type CancerHue } from '@/lib/cancerColors';

// Pure (client-safe) transform: TreeData + filter -> laid-out React Flow graph.
//
// The tree's shape comes entirely from the curated data — no auto-grouping is
// added. Rendering rules:
//   • Stepped map (admin): one level at a time — the current node, its branches
//     as "N trials · M recruiting" counts, and trials attached directly to it
//     as cards.
//   • Drill into a terminal branch: its trials as cards.
//   • expandAll (kiosk) / search: the actual trial cards under their nodes.

export type DecisionNodeData = {
  label: string;
  kind: DecisionNodeDTO['kind'];
  trialCount?: number;
  recruitingCount?: number;
  /** Overrides the kind label shown on the node (e.g. "Phase" for a group). */
  tag?: string;
  /** Which cancer this node belongs to → its brand color. */
  hue?: CancerHue;
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
  hue?: CancerHue;
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

export function buildTree(
  data: TreeData,
  filter: TreeFilter = {},
  opts: { focusNodeId?: string | null; expandAll?: boolean; stepped?: boolean } = {},
) {
  const searching = !!filter.search?.trim();
  const expandAll = !!opts.expandAll;
  const stepped = !!opts.stepped;

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
  let rnodes: RNode[] = [];
  let trialsByNode = new Map<string, TrialDTO[]>();
  let collapse = true;
  // Trials to draw as cards, when that differs from "all held trials" (the
  // stepped map shows a node's own trials as cards but its branches as counts).
  let cardsByNode: Map<string, TrialDTO[]> | null = null;

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

  if (stepped && !searching && !expandAll) {
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
      rnodes.push({ id: node.id, label: node.label, kind: node.kind, parentId: null, tag: node.tag });
      trialsByNode.set(node.id, subtreeTrials(node.id));
      // Sub-branches that are further decision nodes (e.g. biomarkers)…
      for (const id of childDecisions.get(eff) ?? []) {
        const k = byId.get(id)!;
        if (filtering && subtreeTrials(k.id).length === 0) continue;
        rnodes.push({ id: k.id, label: k.label, kind: k.kind, parentId: node.id, tag: k.tag });
        trialsByNode.set(k.id, subtreeTrials(k.id));
      }
      // …plus the trials that sit directly on this node, as cards.
      const own = directByNode.get(eff) ?? [];
      if (own.length) cardsByNode = new Map([[node.id, own]]);
      collapse = true;
    } else {
      // Top level → the cancer-type choices.
      for (const r of data.decisionNodes.filter((n) => !n.parentId)) {
        if (filtering && subtreeTrials(r.id).length === 0) continue;
        rnodes.push({ id: r.id, label: r.label, kind: r.kind, parentId: null, tag: r.tag });
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

  // Which trials render as cards: a stepped node's own trials or, when the view
  // is expanded (kiosk / search / terminal branch), every held trial.
  const cards = cardsByNode ?? (collapse ? new Map<string, TrialDTO[]>() : trialsByNode);

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

  // Trial leaf nodes — each branches off the node it belongs to.
  if (cards.size) {
    for (const [holderId, ts] of cards) {
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
    const headerData: DecisionNodeData = {
      label: n.label,
      kind: n.kind,
      hue: hueFor(rootLabel(n.id, byId)),
    };
    if (n.tag) headerData.tag = n.tag;
    if (held.length && collapse) {
      headerData.trialCount = held.length;
      headerData.recruitingCount = recruitingUnder(held);
    }
    rfNodes.push({
      id: n.id,
      type: 'decision',
      position: { x: p.x - p.width / 2, y: p.y - p.height / 2 },
      data: headerData,
      // Explicit dims so the MiniMap can render node blips (v12 needs these).
      width: p.width,
      height: p.height,
      style: { width: NODE_W },
    });
  }

  // Emit trial leaf nodes.
  if (cards.size) {
    for (const [, ts] of cards) {
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
          width: TRIAL_W,
          height: TRIAL_H,
          data: {
            title: t.title,
            phase: t.phase,
            nctId: t.nctId,
            pi: t.principalInvestigator,
            shorthand: t.shorthand,
            statuses,
            cohorts: t.cohorts.map((c) => ({ label: c.label, status: c.status })),
            compact: true,
            hue: hueFor(rootLabel(t.decisionNodeId, byId)),
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
