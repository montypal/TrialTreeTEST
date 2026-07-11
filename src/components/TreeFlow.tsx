'use client';

import { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type NodeTypes,
  ReactFlowProvider,
} from '@xyflow/react';
import { buildTree } from '@/lib/tree/buildTree';
import { DecisionNode } from '@/components/nodes/DecisionNode';
import { TrialNode } from '@/components/nodes/TrialNode';
import type { TreeData, TreeFilter } from '@/types';

const nodeTypes: NodeTypes = { decision: DecisionNode, trial: TrialNode };

type Props = {
  data: TreeData;
  filter?: TreeFilter;
  /** Kiosk = non-interactive, fit-to-screen, no chrome. */
  kiosk?: boolean;
  /** Collapse trials into per-node counts so the whole tree fits one screen. */
  collapse?: boolean;
};

export function TreeFlow({ data, filter = {}, kiosk = false, collapse = false }: Props) {
  const { nodes, edges } = useMemo(
    () => buildTree(data, filter, { collapse }),
    [data, filter, collapse],
  );

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        <Background gap={kiosk ? 28 : 18} color={kiosk ? '#1c2533' : '#202a3a'} />
        {!kiosk && <Controls showInteractive={false} />}
        {!kiosk && <MiniMap pannable zoomable className="!bg-slate-900" />}
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
