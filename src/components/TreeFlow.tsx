'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  ReactFlow,
  Background,
  useReactFlow,
  type Node,
  type NodeTypes,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  buildTree,
  densityFor,
  FIT_PADDING,
  MAX_FIT_ZOOM,
  MIN_CARD_ZOOM,
  type CanvasSize,
} from '@/lib/tree/buildTree';
import { DecisionNode } from '@/components/nodes/DecisionNode';
import { MoreTrialsNode, TrialNode } from '@/components/nodes/TrialNode';
import type { TreeData, TreeFilter } from '@/types';

const nodeTypes: NodeTypes = { decision: DecisionNode, trial: TrialNode, more: MoreTrialsNode };

/** Floor for the interactive canvas. A stepped level should never plan to go
    anywhere near this, but an expanded search result across every center is a
    genuinely large graph and will hit it. */
const MIN_ZOOM = 0.2;
/** Kiosk: non-interactive, so zoom out as far as needed to show the WHOLE
    expanded tree — a big center's tree can't fit at 0.25, and a cropped part
    would be unreachable. */
const KIOSK_MIN_ZOOM = 0.05;
/** Canvas size changes at or below this (px) are ignored as jitter. */
const RESIZE_THRESHOLD = 8;
/** Let a resize (rotation, split view, a drawer animating) settle before
    re-planning the level — the layout is planned against this number, so it is
    worth paying a beat to only do it once. */
const RESIZE_DEBOUNCE_MS = 140;
/** Counted as "zoomed in" (and so worth panning) past this much of the fitted zoom. */
const ZOOMED_IN_RATIO = 1.05;
/** Margin left above/beside a level that is too big to frame, in CSS px. */
const OVERFLOW_INSET = 12;

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
  /** Draw every trial at this level even if that means shrinking past legible. */
  showAllTrials?: boolean;
  onNodeClick?: (event: MouseEvent, node: Node) => void;
  onPaneClick?: () => void;
  /** Told how many trial cards this level drew, and how many it holds. */
  onCounts?: (shown: number, total: number) => void;
  /** Content for the left of the canvas's own status bar. */
  toolbar?: ReactNode;
};

export function TreeFlow(props: Props) {
  // The provider has to wrap the canvas AND the status bar, because the bar's
  // zoom/fit buttons drive the same viewport.
  return (
    <ReactFlowProvider>
      <TreeCanvas {...props} />
    </ReactFlowProvider>
  );
}

function TreeCanvas({
  data,
  filter = {},
  kiosk = false,
  expandAll = false,
  stepped = false,
  focusNodeId = null,
  showAllTrials = false,
  onNodeClick,
  onPaneClick,
  onCounts,
  toolbar,
}: Props) {
  const { fitView, setViewport, zoomIn, zoomOut } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const minZoom = kiosk ? KIOSK_MIN_ZOOM : MIN_ZOOM;

  // The measured canvas. The stepped layout is planned against it — how many
  // columns the level uses, and how many trials fit at a readable size — so it
  // is state, not just something the fit reacts to.
  const [canvas, setCanvas] = useState<CanvasSize | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Returning the previous object bails the render out, so a resize that
    // lands on the same size (or a hidden canvas reporting 0) costs nothing.
    const commit = (width: number, height: number) => {
      if (width < 1 || height < 1) return;
      setCanvas((prev) =>
        prev &&
        Math.abs(prev.width - width) <= RESIZE_THRESHOLD &&
        Math.abs(prev.height - height) <= RESIZE_THRESHOLD
          ? prev
          : { width, height },
      );
    };
    commit(el.clientWidth, el.clientHeight);

    // Created in an effect (never during render) so it's SSR-safe; very old
    // browsers without ResizeObserver keep the size measured above.
    if (typeof ResizeObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let latestW = el.clientWidth;
    let latestH = el.clientHeight;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      latestW = entry.contentRect.width;
      latestH = entry.contentRect.height;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        commit(latestW, latestH);
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  // A phone gets the reduced card because the full one is too dense for the
  // width. A kiosk gets it for the opposite reason: it draws the WHOLE expanded
  // tree at once, so the more vertical space each card takes the further the
  // fit has to zoom out, and fewer slots at a bigger relative size is what
  // survives being read from ten feet away.
  const density = kiosk ? 'compact' : densityFor(canvas?.width);

  const layout = useMemo(
    () =>
      buildTree(data, filter, {
        focusNodeId,
        expandAll: expandAll || kiosk,
        stepped,
        density,
        canvas,
        showAll: showAllTrials,
        interactive: !kiosk,
      }),
    [data, filter, focusNodeId, expandAll, kiosk, stepped, density, canvas, showAllTrials],
  );

  const { shownTrials, totalTrials, overflow } = layout;
  useEffect(() => {
    onCounts?.(shownTrials, totalTrials);
  }, [onCounts, shownTrials, totalTrials]);

  // How far this view is allowed to zoom out to frame itself. Normally it is the
  // canvas floor — an expanded search across every center is a big graph and has
  // to be allowed to go small. But a level the layout has flagged as overflowing
  // has already decided it would rather be readable than whole, so the floor
  // rises to the legibility limit and the reader moves through what is left over.
  const fitFloor = overflow ? MIN_CARD_ZOOM : minZoom;

  const fitViewOptions = useMemo(
    () => ({ padding: FIT_PADDING, minZoom: fitFloor, maxZoom: MAX_FIT_ZOOM }),
    [fitFloor],
  );

  // The canvas holds still. Dragging the whole tree around was the primary way
  // to move before, and it made a laid-out level feel like a map to wrestle —
  // on touch a stray swipe also dragged the tree away mid-tap. So panning is
  // off until you deliberately zoom in past the framed view, and re-locks the
  // moment the tree is re-framed (drilling, filtering, or tapping "fit").
  const [zoomedIn, setZoomedIn] = useState(false);
  // True when even the framed view didn't fit — the fit bottomed out at the floor
  // and part of the graph is off-screen. Panning has to stay available there or
  // the cropped part is simply unreachable. Two things land here: the expanded
  // graph (a search across every center), and a stepped level the reader has
  // asked to show in full, which holds its cards at a readable size and runs off
  // the bottom rather than shrinking to fit.
  const [cropped, setCropped] = useState(false);
  // The zoom the tree was last framed at — the baseline "zoomed in" compares
  // to. Taken from the first viewport update AFTER a fit rather than read back
  // straight after calling fitView, which can still report the previous zoom.
  const fittedZoomRef = useRef<number | null>(null);
  const awaitingFitRef = useRef(true);
  const handleFitted = useCallback(() => {
    awaitingFitRef.current = true;
    setZoomedIn(false);
  }, []);
  // Typed loosely on purpose: `unknown` accepts whatever event React Flow passes.
  const handleMove = useCallback(
    (_event: unknown, viewport: { zoom: number }) => {
      if (awaitingFitRef.current) {
        awaitingFitRef.current = false;
        fittedZoomRef.current = viewport.zoom;
        setZoomedIn(false);
        setCropped(viewport.zoom <= fitFloor * 1.001);
        return;
      }
      const fitted = fittedZoomRef.current;
      setZoomedIn(fitted !== null && viewport.zoom > fitted * ZOOMED_IN_RATIO);
    },
    [fitFloor],
  );

  // An overflowing level is read from the top down, so it is pinned there rather
  // than framed. fitView cannot express that — it centres the bounding box, which
  // on a grid taller than the canvas hides the first row, the one the reader is
  // actually looking for.
  const pinTop = useCallback(() => {
    if (!canvas) return false;
    const box = boundsOf(layout.nodes);
    if (box.right <= box.x) return false;
    const zoom = MIN_CARD_ZOOM;
    // Centred across the width — the row was planned to fit it — and flush to
    // the top, so the only direction left to travel is down.
    const x = Math.max(OVERFLOW_INSET, (canvas.width - (box.right - box.x) * zoom) / 2) - box.x * zoom;
    const y = OVERFLOW_INSET - box.y * zoom;
    void setViewport({ x, y, zoom }, { duration: 0 });
    // Recorded here rather than waiting for the move event to report it back. We
    // already know both answers — this level overflows by definition, and the zoom
    // is the one we just asked for — and panning must be live on the very first
    // frame, or the rows below the fold are unreachable until something else
    // nudges the viewport.
    awaitingFitRef.current = false;
    fittedZoomRef.current = zoom;
    setCropped(true);
    return true;
  }, [canvas, layout.nodes, setViewport]);

  const frame = useCallback(() => {
    handleFitted();
    if (overflow && pinTop()) return;
    // duration 0 = instant snap (crisp on E-Ink, no ghosting).
    void fitView({ ...fitViewOptions, duration: 0 });
  }, [fitView, fitViewOptions, handleFitted, overflow, pinTop]);

  // Re-frame whenever the level changes shape or the canvas changes size — a
  // live update on a kiosk, a drill-down, a rotated phone. Keyed on the geometry
  // rather than on node identity, so a cosmetic refresh (a live update that only
  // moves a count) doesn't yank the viewport out from under the reader.
  //
  // The box has to be part of that key, not just the node count. Stepping from
  // the three cancer types into a node with two branches plus its pinned card is
  // also three nodes — but at a completely different origin, because the pinned
  // card pushes the grid right by a gutter. Counting alone could not tell those
  // two levels apart, so the canvas stayed framed on the one the reader had just
  // left. The focused node joins the key for a different reason: geometry that
  // happens to match means the frame is already right, but the reader has still
  // moved, and moving is what re-locks panning.
  const box = boundsOf(layout.nodes);
  const shape = [
    layout.nodes.length,
    `${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.right)},${Math.round(box.bottom)}`,
    `${canvas?.width ?? 0}x${canvas?.height ?? 0}`,
    density,
    overflow,
    focusNodeId ?? '',
  ].join(':');
  // `frame` closes over the layout, so it takes a fresh identity on every
  // refetch — including the 5-minute safety-net poll that usually changes
  // nothing the eye can see. Depending on it directly made every one of those
  // snap a reader who had zoomed in back to the framed view. Held in a ref
  // instead, `shape` is genuinely the only trigger, and `shape` already carries
  // everything the frame is computed from.
  const frameRef = useRef(frame);
  useEffect(() => {
    frameRef.current = frame;
  });
  useEffect(() => {
    // Wait one frame so the new nodes are laid out before fitting. By the time
    // it runs the effect above has flushed, so this is the current `frame`.
    const raf = requestAnimationFrame(() => frameRef.current());
    return () => cancelAnimationFrame(raf);
  }, [shape]);

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={containerRef} className="relative min-h-0 w-full flex-1">
        <ReactFlow
          nodes={layout.nodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={minZoom}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          // Cards are click-to-drill, never draggable. Focus lives on the real
          // <button> inside each card instead of on React Flow's wrapper, so
          // there is exactly one tab stop per card and Enter/Space works.
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={!kiosk}
          panOnDrag={kiosk ? false : zoomedIn || cropped}
          // Scroll-pans only once the content genuinely runs past the canvas. A
          // level that fits has nowhere to go, and letting a stray wheel tick
          // drift it away was half of what made this feel like a map to wrestle;
          // a level that overflows is a tall list, and scrolling it is the
          // gesture a reader already has in their hands.
          panOnScroll={kiosk ? false : cropped}
          onMove={kiosk ? undefined : handleMove}
          // Wheel-zoom made every scroll a zoom by accident. Trackpad/touch
          // pinch still works, and the status bar has explicit controls.
          zoomOnScroll={false}
          zoomOnPinch={!kiosk}
          zoomOnDoubleClick={false}
          // Still swallows the wheel/scroll gesture over the canvas even though
          // it no longer zooms — without it a swipe rubber-bands the page on iOS.
          preventScrolling={!kiosk}
        >
          <Background gap={kiosk ? 30 : 22} size={1.4} color="#d4dce7" />
        </ReactFlow>

        {/* An empty level is an answer, not a loading state, so it says so
            rather than leaving the reader looking at a blank canvas. */}
        {layout.emptyLevel && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <p className="max-w-xs rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-center text-sm text-slate-500 shadow-sm">
              <span className="block font-semibold text-slate-700">Nothing to show here</span>
              <span className="mt-1 block">
                Step back with the breadcrumb above, or clear a filter.
              </span>
            </p>
          </div>
        )}
      </div>

      {/* The canvas controls live in their own strip rather than floating over
          the tree: now that a level is sized to fill the canvas, anything
          floating would sit on top of a card. */}
      {!kiosk && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white/90 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] backdrop-blur">
          {/* The live region is this stable wrapper, not the status text inside
              it: that text swaps elements when a level goes from paged to
              "showing all", and a freshly mounted region is not announced. */}
          <div aria-live="polite" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-slate-500">
            {toolbar}
            {/* Panning is off for a level that fits, so saying "drag to move"
                unconditionally would be advice that does nothing. It appears only
                once there is somewhere to go — which is also the only time the
                reader needs telling — and it names only the gestures that are
                actually live: scroll-panning is enabled with `cropped`, not with
                a pinch-zoom the reader drove themselves. */}
            {(cropped || zoomedIn) && (
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-slate-600">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 3v18M12 3L8 7M12 3l4 4M12 21l-4-4M12 21l4-4" />
                </svg>
                {cropped ? 'Drag or scroll to move' : 'Drag to move'}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <CanvasButton label="Zoom out" onClick={() => void zoomOut({ duration: 0 })} hideOnPhone>
              <path d="M5 12h14" />
            </CanvasButton>
            <CanvasButton label="Zoom in" onClick={() => void zoomIn({ duration: 0 })} hideOnPhone>
              <path d="M12 5v14M5 12h14" />
            </CanvasButton>
            <button
              type="button"
              onClick={frame}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700 sm:h-8"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
              Fit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The box a laid-out level occupies, in flow coordinates.
 *
 * Read straight off the nodes rather than measured, because the layout wrote an
 * explicit width and height onto every one of them — there is nothing to wait
 * for, which is what lets the very first frame be the right one. Both callers
 * need the same answer: one to pin an overflowing level to the top, the other to
 * decide whether the level moved at all.
 *
 * Seeded at the origin rather than at ±Infinity: every layout in this file places
 * its first card at x/y >= 0, so the origin is a floor the real box only grows
 * from, and an empty level reports a zero-size box instead of a NaN-shaped one.
 */
function boundsOf(nodes: Node[]): { x: number; y: number; right: number; bottom: number } {
  let x = 0;
  let y = 0;
  let right = 0;
  let bottom = 0;
  for (const n of nodes) {
    x = Math.min(x, n.position.x);
    y = Math.min(y, n.position.y);
    right = Math.max(right, n.position.x + (n.width ?? 0));
    bottom = Math.max(bottom, n.position.y + (n.height ?? 0));
  }
  return { x, y, right, bottom };
}

function CanvasButton({
  label,
  onClick,
  hideOnPhone,
  children,
}: {
  label: string;
  onClick: () => void;
  hideOnPhone?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-700 sm:h-8 sm:w-8 ${
        hideOnPhone ? 'hidden sm:inline-flex' : 'inline-flex'
      }`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}
