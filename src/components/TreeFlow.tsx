'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import {
  ReactFlow,
  Background,
  Controls,
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

/** Breathing room around the tree whenever it's framed. */
const FIT_PADDING = 0.15;
/** Admin map: the user can pan/zoom, so don't let nodes shrink past legible. */
const MIN_ZOOM = 0.2;
/** Kiosk: non-interactive, so zoom out as far as needed to show the WHOLE
    expanded tree — a big center's tree can't fit at 0.2, and a cropped part
    would be unreachable. */
const KIOSK_MIN_ZOOM = 0.05;
/** Canvas size changes at or below this (px) are ignored as jitter. */
const RESIZE_THRESHOLD = 8;
/** Let a resize (rotation, split view, a drawer animating) settle before refitting. */
const RESIZE_DEBOUNCE_MS = 150;
/** Counted as "zoomed in" (and so worth panning) past this much of the fitted zoom. */
const ZOOMED_IN_RATIO = 1.05;

/** Keeps the zoom controls clear of the iPhone home indicator, rounded screen
    corners and the landscape notch. Where there are no safe-area insets (all
    desktops) this is exactly React Flow's default 15px panel margin. */
const CONTROLS_STYLE: CSSProperties = {
  marginLeft: 'max(15px, env(safe-area-inset-left))',
  marginBottom: 'max(15px, env(safe-area-inset-bottom))',
};

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

  // The canvas wrapper — watched for size changes so the tree is re-framed.
  const containerRef = useRef<HTMLDivElement>(null);
  const minZoom = kiosk ? KIOSK_MIN_ZOOM : MIN_ZOOM;
  const fitViewOptions = useMemo(() => ({ padding: FIT_PADDING, minZoom }), [minZoom]);

  // On touch screens a stray swipe used to drag the whole tree away while the
  // user was only trying to tap a node. So the canvas holds still: dragging is
  // off until you deliberately pinch-zoom in, and re-locks when it's re-fitted
  // (drilling to another level, or tapping "fit"). Mice keep dragging as before.
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const sync = () => setTouch(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const [zoomedIn, setZoomedIn] = useState(false);
  // The zoom the tree was last framed at — the baseline "zoomed in" compares to.
  const fittedZoomRef = useRef<number | null>(null);
  const handleFitted = useCallback((zoom: number) => {
    fittedZoomRef.current = zoom;
    setZoomedIn(false);
  }, []);
  // Typed loosely on purpose: `unknown` accepts whatever event React Flow passes.
  const handleMove = useCallback((_event: unknown, viewport: { zoom: number }) => {
    const fitted = fittedZoomRef.current;
    setZoomedIn(fitted !== null && viewport.zoom > fitted * ZOOMED_IN_RATIO);
  }, []);

  // Kiosk never pans. Touch pans only while zoomed in. Mouse pans as before.
  const panOnDrag = kiosk ? false : touch ? zoomedIn : true;

  return (
    <ReactFlowProvider>
      <div ref={containerRef} className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={minZoom}
          maxZoom={1.75}
          proOptions={{ hideAttribution: true }}
          // Nodes are click-to-drill, not draggable (the tree auto-refits, so
          // dragging is pointless) — this also gives a proper click cursor.
          // A tap on a node fires onNodeClick whether or not dragging is on.
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={!kiosk}
          panOnDrag={panOnDrag}
          onMove={kiosk ? undefined : handleMove}
          zoomOnScroll={!kiosk}
          zoomOnPinch={!kiosk}
          zoomOnDoubleClick={!kiosk}
          preventScrolling={!kiosk}
        >
          <Background gap={kiosk ? 30 : 22} size={1.4} color="#d4dce7" />
          {!kiosk && <Controls showInteractive={false} style={CONTROLS_STYLE} />}
          {/* Re-frame the whole tree whenever its structure changes — a live
              update on a kiosk, or a toggle/filter change on admin — or the
              canvas is resized, so it never drifts off-screen. Keyed on node
              count (not identity) so it doesn't fight the user's pan/zoom on
              cosmetic-only refreshes. */}
          <AutoFit
            count={nodes.length}
            minZoom={minZoom}
            containerRef={containerRef}
            onFitted={handleFitted}
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

/**
 * Re-fits the view when:
 *  • the number of nodes changes, and
 *  • the canvas is resized by more than a few px (phone rotation, iPad split
 *    view, the admin filter drawer opening/closing) — otherwise the tree is
 *    left off-center or off-screen.
 * Must render inside <ReactFlow> (it uses useReactFlow).
 */
function AutoFit({
  count,
  minZoom,
  containerRef,
  onFitted,
}: {
  count: number;
  minZoom: number;
  containerRef: RefObject<HTMLDivElement>;
  /** Reports the zoom the tree was framed at, so "zoomed in" has a baseline. */
  onFitted: (zoom: number) => void;
}) {
  const { fitView, getZoom } = useReactFlow();

  useEffect(() => {
    let read = 0;
    // Wait one frame so the new nodes are laid out before fitting.
    const raf = requestAnimationFrame(() => {
      // duration 0 = instant snap (crisp on E-Ink, no ghosting).
      void fitView({ padding: FIT_PADDING, duration: 0, minZoom });
      // Read the resulting zoom a frame later rather than assuming fitView
      // applied synchronously.
      read = requestAnimationFrame(() => onFitted(getZoom()));
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(read);
    };
  }, [count, fitView, getZoom, minZoom, onFitted]);

  useEffect(() => {
    const el = containerRef.current;
    // Created in an effect (never during render) so it's SSR-safe; very old
    // browsers without ResizeObserver just keep the count-based refit.
    if (!el || typeof ResizeObserver === 'undefined') return;

    // Size the tree was last framed at (the effect above does the first fit),
    // and the most recently observed size.
    let fittedW = el.clientWidth;
    let fittedH = el.clientHeight;
    let latestW = fittedW;
    let latestH = fittedH;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let read = 0;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      latestW = entry.contentRect.width;
      latestH = entry.contentRect.height;
      if (
        Math.abs(latestW - fittedW) <= RESIZE_THRESHOLD &&
        Math.abs(latestH - fittedH) <= RESIZE_THRESHOLD
      ) {
        return;
      }
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        // Collapsed/hidden canvas: nothing to frame. Keep the old size so it's
        // only re-framed if it comes back at a different size.
        if (latestW < 1 || latestH < 1) return;
        fittedW = latestW;
        fittedH = latestH;
        void fitView({ padding: FIT_PADDING, duration: 0, minZoom });
        read = requestAnimationFrame(() => onFitted(getZoom()));
      }, RESIZE_DEBOUNCE_MS);
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
      cancelAnimationFrame(read);
    };
  }, [containerRef, fitView, getZoom, minZoom, onFitted]);

  return null;
}
