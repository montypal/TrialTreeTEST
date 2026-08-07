'use client';

import { useEffect, useMemo, type MouseEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type NodeTypes,
  ReactFlowProvider,
} from '@xyflow/react';
import { buildTree } from '@/lib/tree/buildTree';
import { DecisionNode } from '@/components/nodes/DecisionNode';
import { TrialNode } from '@/components/nodes/TrialNode';
import type { TreeData, TreeFilter } from '@/types';

const nodeTypes: NodeTypes = { decision: DecisionNode, trial: TrialNode };

// Colour the minimap blips so the overview map actually reads (light nodes on a
// white minimap were invisible). Decision nodes by kind, trials by recruiting.
const KIND_MINI: Record<string, string> = {
  DISEASE_TYPE: '#3b82f6',
  DISEASE_STATE: '#8b5cf6',
  BIOMARKER: '#10b981',
  LINE_OF_THERAPY: '#f59e0b',
};
function miniMapNodeColor(node: Node): string {
  if (node.type === 'trial') {
    const statuses = (node.data as { statuses?: { status: string }[] }).statuses ?? [];
    return statuses.some((s) => s.status === 'RECRUITING') ? '#10b981' : '#94a3b8';
  }
  const kind = (node.data as { kind?: string }).kind;
  return (kind && KIND_MINI[kind]) || '#93c5fd';
}

type Props = {
  data: TreeData;
  filter?: TreeFilter;
  /** Kiosk = non-interactive, fit-to-screen, no chrome (implies expandAll). */
  kiosk?: boolean;
  /** Show the actual trial cards for everything in view (kiosk uses this). */
  expandAll?: boolean;
  /** Stepped drill-down: one level at a time (cancer → state → approach → trials). */
  stepped?: boolean;
  /** Drill into a single branch. */
  focusNodeId?: string | null;
  onNodeClick?: (event: MouseEvent, node: Node) => void;
  onPaneClick?: () => void;
};

export function TreeFlow({
  data,
  filter = {},
  kiosk = false,
  expandAll = false,
  stepped = false,
  focusNodeId = null,
  onNodeClick,
  onPaneClick,
}: Props) {
  const { nodes, edges } = useMemo(
    () => buildTree(data, filter, { focusNodeId, expandAll: expandAll || kiosk, stepped }),
    [data, filter, focusNodeId, expandAll, kiosk, stepped],
  );

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        // Kiosk: lock interaction so a bumped TV/E-Ink panel can't scroll away.
        nodesDraggable={!kiosk}
        nodesConnectable={false}
        elementsSelectable={!kiosk}
        panOnDrag={!kiosk}
        zoomOnScroll={!kiosk}
        zoomOnPinch={!kiosk}
        zoomOnDoubleClick={!kiosk}
        preventScrolling={!kiosk}
      >
        <Background gap={kiosk ? 28 : 18} color="#e2e8f0" />
        {!kiosk && <Controls showInteractive={false} />}
        {!kiosk && (
          <MiniMap
            pannable
            zoomable
            className="!bg-white"
            bgColor="#f8fafc"
            maskColor="rgba(148,163,184,0.12)"
            nodeColor={miniMapNodeColor}
            nodeStrokeColor="#ffffff"
            nodeStrokeWidth={2}
            nodeBorderRadius={6}
          />
        )}
        {/* Re-frame the whole tree whenever its structure changes — a live
            update on a kiosk, or a toggle/filter change on admin — so it never
            drifts off-screen. Keyed on node count so it doesn't fight the user's
            pan/zoom on cosmetic-only refreshes. */}
        <AutoFit count={nodes.length} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

/** Re-fits the view whenever the number of nodes changes. */
function AutoFit({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    // Wait one frame so the new nodes are laid out before fitting.
    const raf = requestAnimationFrame(() => {
      // duration 0 = instant snap (crisp on E-Ink, no ghosting).
      void fitView({ padding: 0.15, duration: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [count, fitView]);
  return null;
}
