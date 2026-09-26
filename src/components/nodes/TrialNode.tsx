'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Density, MoreTrialsNodeData, TrialNodeData } from '@/lib/tree/buildTree';
import { TRIAL_BORDER } from '@/lib/cancerColors';
import type { RecruitmentStatus } from '@/types';

// ---------------------------------------------------------------------------
// ONE content hierarchy, used by every trial card:
//
//   1. Recruitment — the only thing that decides whether the rest matters.
//   2. Phase — the second question every reader asks.
//   3. The study's name.
//   4. (full size only) Its identifiers: NCT number and lead PI.
//   5. Which centers run it, and where each of those stands.
//
// Every card renders those slots, in that order, at the same size. A missing
// value shows as a muted "not listed", never as a different-looking label and
// never as a stand-in value — the old card printed the phase when it had one
// and the word "Trial" when it did not, so two cards could look like two kinds
// of thing when the only real difference was a gap in the data.
//
// The small card drops slots 4 (and trims 5) rather than shrinking type: on a
// phone the fix for a crowded card is less on it, not smaller text on it.
// ---------------------------------------------------------------------------

/** Filled = open in some form, hollow = not, so status is not colour alone. */
// Kept identical to TrialSiteMap's STATUS_DOT: filled, ringed or hollow, so a
// status is told apart by shape as well as by colour.
const SITE_DOT: Record<RecruitmentStatus, string> = {
  RECRUITING: 'bg-emerald-500',
  WAITLISTED: 'bg-amber-400 ring-1 ring-amber-700',
  SUSPENDED: 'bg-rose-500 ring-1 ring-rose-800',
  CLOSED: 'border border-slate-500 bg-transparent',
};

const STATUS_PILL: Record<RecruitmentStatus, string> = {
  RECRUITING: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  WAITLISTED: 'bg-amber-50 text-amber-800 ring-amber-200',
  SUSPENDED: 'bg-rose-50 text-rose-700 ring-rose-200',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-300',
};

const STATUS_LABEL: Record<RecruitmentStatus, string> = {
  RECRUITING: 'Recruiting',
  WAITLISTED: 'Waitlist',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
};

/** Worst-to-best precedence: one open site makes the whole study open. */
const PRECEDENCE: RecruitmentStatus[] = ['RECRUITING', 'WAITLISTED', 'SUSPENDED', 'CLOSED'];

const SCALE: Record<Density, { pad: string; pill: string; name: string; meta: string; sites: number }> = {
  // 0.7rem (11.2px) is the floor for anything a reader needs, now that cards
  // are never drawn below their authored size. The compact card shows two sites
  // rather than three: at 11px, three names wrap the site row onto a second
  // line, which the fixed-height card would clip — silently dropping a site.
  comfortable: {
    pad: 'px-3 py-3',
    pill: 'text-[0.68rem]',
    name: 'text-[0.85rem]',
    meta: 'text-[0.7rem]',
    sites: 4,
  },
  compact: {
    pad: 'px-2.5 py-2',
    pill: 'text-[0.65rem]',
    name: 'text-[0.8rem]',
    meta: 'text-[0.7rem]',
    sites: 2,
  },
};

export function TrialNode({ data }: NodeProps) {
  const d = data as TrialNodeData;
  const s = SCALE[d.density];
  const overall = PRECEDENCE.find((p) => d.statuses.some((x) => x.status === p)) ?? null;
  const anyRecruiting = overall === 'RECRUITING';
  // Recruiting cards wear their cancer's color; closed ones stay neutral so the
  // open studies are what the eye lands on first.
  const accent = anyRecruiting ? TRIAL_BORDER[d.hue ?? 'slate'] : 'border-slate-200';
  // The shorthand is how a clinician refers to the study; the full title is the
  // fallback when there isn't one, and is always available in the detail panel.
  const name = d.shorthand ?? d.title;
  const shownSites = d.statuses.slice(0, s.sites);
  const extraSites = d.statuses.length - shownSites.length;

  const shell = `tt-card flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm ${s.pad} ${accent}`;

  const body = (
    <>
      <div className="flex items-center justify-between gap-1.5">
        {overall ? (
          <span
            className={`tt-pill shrink-0 rounded-full px-2 py-0.5 ${s.pill} font-bold uppercase tracking-wide ring-1 ${STATUS_PILL[overall]}`}
          >
            {STATUS_LABEL[overall]}
          </span>
        ) : (
          <span className={`shrink-0 ${s.pill} font-semibold uppercase tracking-wide text-slate-500`}>
            Status not listed
          </span>
        )}
        {/* An absent value is spelled out, never swapped for a different-looking
            label and never guessed. The wording carries the difference, so the
            muted shade stays above the 4.5:1 contrast floor rather than fading
            out of legibility the way a placeholder grey usually does. */}
        {d.phase ? (
          <span className={`truncate ${s.pill} font-bold uppercase tracking-wide text-slate-600`}>
            {d.phase}
          </span>
        ) : (
          <span className={`truncate ${s.pill} font-medium uppercase tracking-wide text-slate-500`}>
            Phase not listed
          </span>
        )}
      </div>

      <div
        className={`mt-1 line-clamp-2 break-words ${s.name} font-semibold leading-tight text-slate-900`}
      >
        {name}
      </div>

      {d.density === 'comfortable' && (
        <div className={`mt-1 truncate ${s.meta} text-slate-500`}>
          <span className={d.nctId ? 'text-slate-600' : ''}>{d.nctId ?? 'NCT not listed'}</span>
          <span className="text-slate-400"> · </span>
          <span className={d.pi ? 'text-slate-600' : ''}>{d.pi ? `PI ${d.pi}` : 'PI not listed'}</span>
        </div>
      )}

      <div className={`mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1.5 ${s.meta}`}>
        {shownSites.length === 0 ? (
          <span className="text-slate-500">No site listed</span>
        ) : (
          shownSites.map((site, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-slate-600">
              <span
                aria-hidden
                className={`tt-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full ${SITE_DOT[site.status]}`}
              />
              {site.short}
              <span className="sr-only">: {STATUS_LABEL[site.status]}</span>
            </span>
          ))
        )}
        {extraSites > 0 && (
          <span className="text-slate-500">
            +{extraSites}
            {/* The words don't fit a phone card's row; "+1" beside the site
                names reads the same to the eye, and a screen reader still hears it. */}
            <span className={d.density === 'compact' ? 'sr-only' : ''}>
              {' '}more site{extraSites === 1 ? '' : 's'}
            </span>
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {d.interactive ? (
        <button type="button" className={shell} title={d.title}>
          {body}
          <span className="sr-only">— open trial details</span>
        </button>
      ) : (
        <div className={shell} title={d.title}>
          {body}
        </div>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </>
  );
}

/**
 * The tile that stands in for the trials a level could not show at a readable
 * size. It states the number it is holding back — a level that quietly renders
 * 8 of 15 studies is worse than one that renders 8 and says so.
 */
export function MoreTrialsNode({ data }: NodeProps) {
  const d = data as MoreTrialsNodeData;
  const s = SCALE[d.density];
  const shell = `tt-card flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white/70 text-center ${s.pad}`;
  const body = (
    <>
      <span className="font-display text-xl font-extrabold leading-none text-slate-700">+{d.hidden}</span>
      <span className={`${s.name} font-semibold text-slate-700`}>
        more trial{d.hidden === 1 ? '' : 's'}
      </span>
      <span className={`${s.meta} text-slate-500`}>Show all {d.total}</span>
    </>
  );

  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {d.interactive ? (
        <button type="button" className={shell}>
          {body}
        </button>
      ) : (
        <div className={shell}>{body}</div>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </>
  );
}
