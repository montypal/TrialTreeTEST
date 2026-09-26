'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DecisionNodeData, Density } from '@/lib/tree/buildTree';
import { NODE } from '@/lib/cancerColors';

// Fallback axis labels for nodes without a curated tag.
const KIND_LABEL: Record<string, string> = {
  DISEASE_TYPE: 'Disease',
  DISEASE_STATE: 'State',
  LINE_OF_THERAPY: 'Line',
  BIOMARKER: 'Biomarker',
};

// Tailwind's JIT only sees class names written out in full, so the type scale
// is a lookup of literal strings — same rule cancerColors.ts follows.
const SCALE: Record<Density, { pad: string; tag: string; label: string; meta: string }> = {
  // Same 0.7rem floor as the trial cards for the counts a reader acts on. The
  // tag is an uppercase, tracked axis label ("STAGE"), which reads larger than
  // its size, so it sits a step below.
  comfortable: {
    pad: 'px-3.5 py-3',
    tag: 'text-[0.65rem]',
    label: 'text-[0.95rem]',
    meta: 'text-[0.7rem]',
  },
  compact: {
    pad: 'px-2.5 py-2',
    tag: 'text-[0.62rem]',
    label: 'text-[0.82rem]',
    meta: 'text-[0.7rem]',
  },
};

/**
 * A branch of the tree. The card is a fixed box — the layout wrote its exact
 * width and height onto the node — so everything inside either fits or is
 * clamped. Nothing here is allowed to grow the card, because the layout has
 * already reserved that space and a taller card would land on its neighbour.
 */
export function DecisionNode({ data }: NodeProps) {
  const d = data as DecisionNodeData;
  // Tinted by cancer (prostate blue / bladder purple / kidney orange), fading
  // from the root toward the leaves.
  const style = NODE[d.hue ?? 'slate'][d.kind] ?? NODE.slate.DISEASE_TYPE;
  const s = SCALE[d.density];
  const hasCount = typeof d.trialCount === 'number';

  const shell = [
    'tt-card flex h-full w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm',
    s.pad,
    style.box,
    d.context ? 'ring-2 ring-slate-300' : '',
    // With no count row to anchor the bottom of the card, the label centres
    // itself rather than sitting in the top half above a band of nothing.
    hasCount ? '' : 'justify-center',
  ].join(' ');

  const body = (
    <>
      {/* The axis this branch sits on (Stage / Histology / Line), so colour is
          never the only thing saying where you are. The pinned card says so in
          words too — a ring alone doesn't read as "this is not a choice". */}
      <div className={`truncate ${s.tag} font-bold uppercase tracking-[0.14em] ${style.accent}`}>
        {d.context ? 'Viewing · ' : ''}
        {d.tag ?? KIND_LABEL[d.kind] ?? 'Branch'}
      </div>
      <div
        className={`mt-0.5 line-clamp-2 break-words font-display ${s.label} font-bold leading-tight text-slate-900`}
      >
        {d.label}
      </div>
      {/* Counts sit on the baseline of the card so every branch reads at the
          same glance-height. "None recruiting" is spelled out rather than left
          off — an absent pill would be indistinguishable from a missing one.
          Expanded views (kiosk, search) draw the trials themselves beside the
          branch, so there is no count and the row is dropped. The card keeps its
          height from the explicit one the layout writes onto the node, not from
          anything reserved here. */}
      {hasCount && (
        <div className={`mt-auto flex min-w-0 flex-nowrap items-center gap-1 pt-1.5 ${s.meta} font-semibold`}>
          <span className="tt-pill shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-slate-600 ring-1 ring-slate-200">
            {d.trialCount} trial{d.trialCount === 1 ? '' : 's'}
          </span>
          {d.recruitingCount ? (
            <span className="tt-pill min-w-0 truncate rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
              {d.recruitingCount} recruiting
            </span>
          ) : (
            <span className="tt-pill min-w-0 truncate rounded-full bg-slate-50 px-2 py-0.5 text-slate-500 ring-1 ring-slate-200">
              None recruiting
            </span>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {d.interactive ? (
        // A real button, so Tab reaches it and Enter/Space drills in. The click
        // it fires bubbles to React Flow's onNodeClick, which is the same path
        // a mouse takes — there is no second code path to keep in sync.
        <button type="button" className={shell} title={d.label}>
          {body}
          <span className="sr-only">— open this branch</span>
        </button>
      ) : (
        <div className={shell} title={d.label}>
          {body}
        </div>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </>
  );
}
