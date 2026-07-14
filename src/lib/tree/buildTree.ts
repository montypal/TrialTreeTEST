import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';
import type { TreeData, TreeFilter, TrialDTO, DecisionNodeDTO } from '@/types';
import { centerBySlug } from '@/lib/locations';

// Pure (client-safe) transform: TreeData + filter -> laid-out React Flow graph.
// Used by both the admin canvas and the kiosk display so they stay in sync.
//
// Two rendering modes (there can be hundreds of real trials):
//   • collapse=true  → structural overview: decision nodes only, each leaf shows
//     a "N trials · M recruiting" badge. The whole tree fits on one screen.
//   • collapse=false → trials render, wrapped into a compact GRID under each
//     decision node (not one long horizontal row).

export type DecisionNodeData = {
  label: string;
  kind: DecisionNodeDTO['kind'];
  trialCount?: number; // set in collapsed mode
  recruitingCount?: number; // set in collapsed mode
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
const TRIAL_H = 104;
const GAP = 12;
const COLS = 4; // max trial cards per row within a group
const HEADER_GAP = 16; // space between a decision header and its trial grid

function trialMatchesFilter(trial: TrialDTO, filter: TreeFilter): boolean {
  if (filter.locationSlug) {
    if (!trial.locations.some((l) => l.locationSlug === filter.locationSlug)) return false;
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
  opts: { collapse?: boolean; focusNodeId?: string | null } = {},
) {
  const focusNodeId = opts.focusNodeId ?? null;
  // Drilling into a branch always shows its trials; otherwise honor `collapse`.
  const collapse = focusNodeId ? false : (opts.collapse ?? false);

  const byId = new Map(data.decisionNodes.map((n) => [n.id, n] as const));

  let trials = data.trials.filter((t) => trialMatchesFilter(t, filter));
  if (focusNodeId) {
    // Restrict to the focused node and everything beneath it.
    const childMap = new Map<string, string[]>();
    for (const n of data.decisionNodes) {
      if (!n.parentId) continue;
      const arr = childMap.get(n.parentId) ?? [];
      arr.push(n.id);
      childMap.set(n.parentId, arr);
    }
    const inFocus = new Set<string>();
    const stack = [focusNodeId];
    while (stack.length) {
      const id = stack.pop()!;
      if (inFocus.has(id)) continue;
      inFocus.add(id);
      for (const c of childMap.get(id) ?? []) stack.push(c);
    }
    trials = trials.filter((t) => inFocus.has(t.decisionNodeId));
  }

  // Group surviving trials by the decision node they hang off.
  const trialsByNode = new Map<string, TrialDTO[]>();
  for (const t of trials) {
    const arr = trialsByNode.get(t.decisionNodeId) ?? [];
    arr.push(t);
    trialsByNode.set(t.decisionNodeId, arr);
  }

  // Needed decision nodes = every ancestor of a node that holds ≥1 trial.
  const neededNodeIds = new Set<string>();
  for (const nodeId of trialsByNode.keys()) {
    let cur: DecisionNodeDTO | undefined = byId.get(nodeId);
    while (cur) {
      neededNodeIds.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }

  const g = new dagre.graphlib.Graph();
  // Left-to-right: disease branches stack vertically, depth grows rightward —
  // reads like an organized outline instead of one very wide row.
  g.setGraph({ rankdir: 'LR', nodesep: 26, ranksep: 90, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  // 1. Size + register decision nodes (reserving grid space when expanded).
  for (const n of data.decisionNodes) {
    if (!neededNodeIds.has(n.id)) continue;
    const held = trialsByNode.get(n.id);
    if (!collapse && held && held.length) {
      const { gridW, gridH } = gridSize(held.length);
      const headerH = decisionHeight(n.label, false);
      g.setNode(n.id, { width: Math.max(NODE_W, gridW), height: headerH + HEADER_GAP + gridH });
    } else {
      // Reserve enough height for a (possibly two-line) label + count badge so
      // sibling boxes never overlap.
      g.setNode(n.id, { width: NODE_W, height: decisionHeight(n.label, collapse && !!held?.length) });
    }
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

  dagre.layout(g);

  const locSlug = filter.locationSlug ?? null;
  const recruitingUnder = (arr: TrialDTO[]) =>
    arr.filter((t) =>
      t.locations.some((l) => (!locSlug || l.locationSlug === locSlug) && l.status === 'RECRUITING'),
    ).length;

  // 2. Emit positioned nodes.
  for (const n of data.decisionNodes) {
    if (!neededNodeIds.has(n.id)) continue;
    const p = g.node(n.id);
    const held = trialsByNode.get(n.id) ?? [];
    const boxTop = p.y - p.height / 2;

    // Decision header — centered at the top of its (possibly wide) reserved box.
    const headerData: DecisionNodeData = { label: n.label, kind: n.kind };
    if (collapse && held.length) {
      headerData.trialCount = held.length;
      headerData.recruitingCount = recruitingUnder(held);
    }
    rfNodes.push({
      id: n.id,
      type: 'decision',
      position: { x: p.x - NODE_W / 2, y: boxTop },
      data: headerData,
      style: { width: NODE_W },
    });

    // Trial grid (expanded mode only).
    if (!collapse && held.length) {
      const cols = Math.min(COLS, held.length);
      const gridW = cols * TRIAL_W + (cols - 1) * GAP;
      const gridLeft = p.x - gridW / 2;
      const gridTop = boxTop + decisionHeight(n.label, false) + HEADER_GAP;

      held.forEach((t, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const statuses = (locSlug ? t.locations.filter((l) => l.locationSlug === locSlug) : t.locations)
          .map((l) => ({
            locationName: l.locationName,
            short: centerBySlug(l.locationSlug)?.shortName ?? l.locationName,
            status: l.status,
          }));
        rfNodes.push({
          id: `trial-${t.id}`,
          type: 'trial',
          position: { x: gridLeft + col * (TRIAL_W + GAP), y: gridTop + row * (TRIAL_H + GAP) },
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
          style: { width: TRIAL_W },
          draggable: false,
          selectable: true,
        });
      });
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}

function gridSize(k: number) {
  const cols = Math.min(COLS, k);
  const rows = Math.ceil(k / cols);
  return {
    gridW: cols * TRIAL_W + (cols - 1) * GAP,
    gridH: rows * TRIAL_H + (rows - 1) * GAP,
  };
}

// Estimated rendered height of a decision box so dagre reserves enough vertical
// room (labels can wrap to 2 lines; the count badge adds another row).
function decisionHeight(label: string, hasCount: boolean): number {
  const lines = Math.max(1, Math.ceil(label.length / 18));
  return 46 + lines * 22 + (hasCount ? 30 : 0);
}
