'use client';

import { useEffect, useMemo } from 'react';
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

type Props = {
  data: TreeData;
  filter?: TreeFilter;
  /** Kiosk = non-interactive, fit-to-screen, no chrome. */
  kiosk?: boolean;
};

export function TreeFlow({ data, filter = {}, kiosk = false }: Props) {
  const { nodes, edges } = useMemo(() => buildTree(data, filter), [data, filter]);

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
        {/* Kiosks lock panning, so re-fit the viewport every time the tree
            redraws after a live update — otherwise the board can drift
            off-screen with no one there to pan it back. */}
        {kiosk && <AutoFit nodes={nodes} />}
      </ReactFlow>
    </ReactFlowProvider>
  );
}

/** Re-fits the view whenever the node set changes (kiosk only). */
function AutoFit({ nodes }: { nodes: Node[] }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    // Wait one frame so the new nodes are laid out before fitting.
    const raf = requestAnimationFrame(() => {
      // duration 0 = instant snap (crisp on E-Ink, no ghosting).
      void fitView({ padding: 0.15, duration: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [nodes, fitView]);
  return null;
}
