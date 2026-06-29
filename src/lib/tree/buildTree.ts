import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TreeData, TreeFilter, TrialDTO, DecisionNodeDTO } from '@/types';

// Pure (client-safe) transform: TreeData + filter -> laid-out React Flow graph.
// Used by both the admin canvas and the kiosk display so they stay in sync.

export type DecisionNodeData = { label: string; kind: DecisionNodeDTO['kind'] };
export type TrialNodeData = {
  title: string;
  phase: string | null;
  nctId: string | null;
  pi: string | null;
  shorthand: string | null;
  /** Per-location statuses relevant to the current view. */
  statuses: { locationName: string; status: TrialDTO['locations'][number]['status'] }[];
  cohorts: { label: string; status: string }[];
};

const NODE_W = 230;
const DECISION_H = 64;
const TRIAL_H = 120;

function trialMatchesFilter(trial: TrialDTO, filter: TreeFilter): boolean {
  if (filter.locationSlug) {
    const here = trial.locations.some((l) => l.locationSlug === filter.locationSlug);
    if (!here) return false;
  }
  if (filter.pi) {
    const piHit =
      trial.principalInvestigator === filter.pi ||
      trial.locations.some((l) => l.piName === filter.pi);
    if (!piHit) return false;
  }
  return true;
}

export function buildTree(data: TreeData, filter: TreeFilter = {}) {
  // 1. Which trials survive the filter, and which decision nodes do they need?
  const trials = data.trials.filter((t) => trialMatchesFilter(t, filter));
  const neededNodeIds = new Set<string>();

  const byId = new Map(data.decisionNodes.map((n) => [n.id, n]));
  // Walk each surviving trial's branch up to the root so the path is intact.
  for (const t of trials) {
    let cur: DecisionNodeDTO | undefined = byId.get(t.decisionNodeId);
    while (cur) {
      neededNodeIds.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 70, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  // 2. Decision nodes.
  for (const n of data.decisionNodes) {
    if (!neededNodeIds.has(n.id)) continue;
    g.setNode(n.id, { width: NODE_W, height: DECISION_H });
    if (n.parentId && neededNodeIds.has(n.parentId)) {
      g.setEdge(n.parentId, n.id);
      rfEdges.push({
        id: `e-${n.parentId}-${n.id}`,
        source: n.parentId,
        target: n.id,
        type: 'smoothstep',
      });
    }
  }

  // 3. Trial leaf nodes hang off their decision node.
  for (const t of trials) {
    const id = `trial-${t.id}`;
    g.setNode(id, { width: NODE_W, height: TRIAL_H });
    g.setEdge(t.decisionNodeId, id);
    rfEdges.push({
      id: `e-${t.decisionNodeId}-${id}`,
      source: t.decisionNodeId,
      target: id,
      type: 'smoothstep',
    });
  }

  dagre.layout(g);

  // 4. Emit positioned React Flow nodes.
  for (const n of data.decisionNodes) {
    if (!neededNodeIds.has(n.id)) continue;
    const pos = g.node(n.id);
    rfNodes.push({
      id: n.id,
      type: 'decision',
      position: { x: pos.x - NODE_W / 2, y: pos.y - DECISION_H / 2 },
      data: { label: n.label, kind: n.kind } satisfies DecisionNodeData,
    });
  }

  for (const t of trials) {
    const id = `trial-${t.id}`;
    const pos = g.node(id);
    const statuses = (filter.locationSlug
      ? t.locations.filter((l) => l.locationSlug === filter.locationSlug)
      : t.locations
    ).map((l) => ({ locationName: l.locationName, status: l.status }));

    rfNodes.push({
      id,
      type: 'trial',
      position: { x: pos.x - NODE_W / 2, y: pos.y - TRIAL_H / 2 },
      data: {
        title: t.title,
        phase: t.phase,
        nctId: t.nctId,
        pi: t.principalInvestigator,
        shorthand: t.shorthand,
        statuses,
        cohorts: t.cohorts.map((c) => ({ label: c.label, status: c.status })),
      } satisfies TrialNodeData,
    });
  }

  return { nodes: rfNodes, edges: rfEdges };
}
