'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Density, MoreTrialsNodeData, TrialNodeData } from '@/lib/tree/buildTree';
import { TRIAL_BORDER } from '@/lib/cancerColors';
import type { RecruitmentStatus } from '@/types';

// ---------------------------------------------------------------------------
// ONE content hierarchy, used by every trial card — the questions a physician
// asks of a study, in the order they ask them:
//
//   1. Recruitment — the only thing that decides whether the rest matters.
//   2. Phase — the second question every reader asks.
//   3. The study's name.
//   4. What is being given, and how it works (intervention, then mechanism).
//   5. Why the study exists: the one-sentence clinical brief.
//   6. Which centers run it, where each stands, and (full size) each site's PI.
//   7. (full size only) Its NCT number and the disease it sits under.
//
// Every card renders those slots, in that order, at the same size. A missing
// status or phase is spelled out, never swapped for a different-looking label
// and never guessed — the old card printed the word "Trial" when it had no
// phase, so two cards could look like two kinds of thing when the only real
// difference was a gap in the data. A missing intervention, mechanism or brief
// drops its line instead: those describe the study, and an empty description
// tells a reader nothing. A missing NCT or PI uses the site-wide wording, so
// the gap reads the same here as in the detail panel.
//
// The small card drops slot 7 and the PIs, and clamps the brief to two lines,
// rather than shrinking type: on a phone the fix for a crowded card is less on
// it, not smaller text on it. All of it is one tap away in the detail panel.
//
// The card is a fixed box. buildTree reserves CARD_METRICS[density].trialH for
// it and never measures, so every block below has an explicit line height and
// a clamp, and trialH is the sum of those lines at their worst case. A new line
// here is a new number there.
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

/** The site-wide wording for a gap, so it reads the same on every surface. */
const NO_NCT = 'NCT number pending verification';
const NO_PI = 'Principal Investigator information unavailable';

const SCALE: Record<
  Density,
  {
    pad: string;
    pill: string;
    name: string;
    nameClamp: string;
    drug: string;
    meta: string;
    brief: string;
    /** The brief's clamp when the full card needs its own PI line. */
    briefTight: string;
    footer: string;
    sites: number;
  }
> = {
  // 0.7rem (11.2px) is the floor for anything a reader needs, now that cards
  // are never drawn below their authored size — the status pill included.
  //
  // Line heights are pinned (leading-4 = 16px, leading-tight on the name) so
  // each block's height is a known number rather than whatever the font's
  // metrics make of "normal". Comfortable, worst case: 20 padding + 20 status
  // row + 21 name (one line) + 20 intervention + 18 mechanism + 36 brief (two
  // lines) + 8 + 16 sites and PIs (one line) + 18 NCT and disease, + 2 border
  // = 179. When no shown site names a PI, the brief gives up a line to the
  // "Lead PI" / "information unavailable" line, so the sum holds. Compact: 16 +
  // 20 + 36 + 20 + 18 + 36 brief + 6 + 16 sites, + 2 = 170. Both are what
  // trialH (buildTree's CARD_METRICS) is built from.
  //
  // The full card is held to 179 on purpose: at that height two rows of trials
  // frame on a 1366x768 laptop and three in a maximised 1080p window. The full
  // title, regimen, summary and site list are one tap away in the panel.
  //
  // Two sites, not more, at either size. A third would not fit the one site
  // line; the "+N" beside them says how many more there are.
  comfortable: {
    pad: 'px-3 py-2.5',
    pill: 'text-[0.7rem]',
    name: 'text-[0.85rem]',
    nameClamp: 'line-clamp-1',
    drug: 'text-[0.75rem]',
    meta: 'text-[0.7rem]',
    brief: 'line-clamp-2',
    briefTight: 'line-clamp-1',
    footer: 'pt-2',
    sites: 2,
  },
  compact: {
    pad: 'px-2.5 py-2',
    pill: 'text-[0.7rem]',
    name: 'text-[0.8rem]',
    nameClamp: 'line-clamp-2',
    drug: 'text-[0.75rem]',
    meta: 'text-[0.7rem]',
    brief: 'line-clamp-2',
    briefTight: 'line-clamp-2',
    footer: 'pt-1.5',
    sites: 2,
  },
};

type Site = TrialNodeData['statuses'][number];

export function TrialNode({ data }: NodeProps) {
  const d = data as TrialNodeData;
  const s = SCALE[d.density];
  const full = d.density === 'comfortable';
  const overall = PRECEDENCE.find((p) => d.statuses.some((x) => x.status === p)) ?? null;
  const anyRecruiting = overall === 'RECRUITING';
  // Recruiting cards wear their cancer's color; closed ones stay neutral so the
  // open studies are what the eye lands on first.
  const accent = anyRecruiting ? TRIAL_BORDER[d.hue ?? 'slate'] : 'border-slate-200';
  // The shorthand is how a clinician refers to the study; the full title is the
  // fallback when there isn't one, and is always available in the detail panel.
  const name = d.shorthand ?? d.title;
  // buildTree hands the sites over open-first, so the ones left off a full card
  // are never the places a patient could actually enrol.
  const shownSites = d.statuses.slice(0, s.sites);
  const extraSites = d.statuses.length - shownSites.length;
  // A PI is named beside its own center. When no shown site has one, the gap
  // is said once, on its own line, rather than once per site.
  const sitePis = full && shownSites.some((site) => site.pi);
  // The full card's extra line for that case; the brief yields a line to it.
  const needsPiLine = full && !sitePis;

  const shell = `tt-card flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm ${s.pad} ${accent}`;

  const body = (
    <>
      <div className="flex items-center justify-between gap-1.5 leading-4">
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
        className={`mt-1 ${s.nameClamp} break-words ${s.name} font-semibold leading-tight text-slate-900`}
      >
        {name}
      </div>

      {/* What is given and how it works, in the order a physician asks. One line
          each: the drug is the thing to recognise at a glance, and the full
          regimen is in the detail panel. */}
      {d.intervention && (
        <div className={`mt-1 truncate ${s.drug} font-semibold leading-4 text-slate-800`}>
          {d.intervention}
        </div>
      )}
      {d.mechanism && (
        <div className={`mt-0.5 truncate ${s.meta} font-medium leading-4 text-slate-600`}>
          {d.mechanism}
        </div>
      )}
      {d.brief && (
        <div className={`mt-1 break-words ${needsPiLine ? s.briefTight : s.brief} ${s.meta} leading-4 text-slate-600`}>
          {d.brief}
        </div>
      )}

      {/* Pinned to the bottom, so the sites and identifiers sit at the same
          height on every card in a row however much text is above them. */}
      <div className={`mt-auto ${s.footer} ${s.meta} leading-4`}>
        {sitePis ? (
          // One line: the sites share it and truncate rather than wrap, so a
          // second site is shortened, never pushed onto a line the box lacks.
          <div className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-hidden whitespace-nowrap">
            {shownSites.map((site, i) => (
              <span key={i} className="inline-flex min-w-0 items-center gap-1">
                <SiteDot status={site.status} />
                <span className="min-w-0 truncate">
                  <span className="font-medium text-slate-700">{site.short}</span>
                  {site.pi && (
                    <>
                      <span className="text-slate-400"> · </span>
                      <span className="text-slate-600">{site.pi}</span>
                    </>
                  )}
                </span>
                <span className="sr-only">: {STATUS_LABEL[site.status]}</span>
              </span>
            ))}
            <ExtraSites count={extraSites} />
          </div>
        ) : (
          <>
            <SiteNames sites={shownSites} extra={extraSites} />
            {needsPiLine && (
              // d.pi is the lead PI from the ClinicalTrials.gov record (the
              // lists name only site PIs), so it is labelled as such.
              <div className="truncate text-slate-500">
                {d.pi ? <span className="text-slate-600">Lead PI {d.pi}</span> : NO_PI}
              </div>
            )}
          </>
        )}
        {full && (
          <div className="mt-0.5 truncate text-slate-500">
            {d.nctId ? <span className="text-slate-600">{d.nctId}</span> : NO_NCT}
            {d.disease && (
              <>
                <span className="text-slate-400"> · </span>
                {d.disease}
              </>
            )}
          </div>
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

function SiteDot({ status }: { status: RecruitmentStatus }) {
  return (
    <span
      aria-hidden
      className={`tt-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full ${SITE_DOT[status]}`}
    />
  );
}

/** Center names only, on one line — the small card's site row, and the full
    card's when no shown site names a PI. */
function SiteNames({ sites, extra }: { sites: Site[]; extra: number }) {
  return (
    <div className="flex min-w-0 items-center gap-x-2 overflow-hidden whitespace-nowrap">
      {sites.length === 0 ? (
        <span className="text-slate-500">No site listed</span>
      ) : (
        sites.map((site, i) => (
          <span key={i} className="inline-flex shrink-0 items-center gap-1 text-slate-600">
            <SiteDot status={site.status} />
            {site.short}
            <span className="sr-only">: {STATUS_LABEL[site.status]}</span>
          </span>
        ))
      )}
      <ExtraSites count={extra} />
    </div>
  );
}

/** "+2" beside the site names reads the same to the eye as "+2 more sites", and
    fits beside a site and its PI on a narrow card; a screen reader still hears
    the words. */
function ExtraSites({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="shrink-0 text-slate-500">
      +{count}
      <span className="sr-only"> more site{count === 1 ? '' : 's'}</span>
    </span>
  );
}

/**
 * The tile that stands in for the trials a level could not show at a readable
 * size. It states the number it is holding back — a level that quietly renders
 * 8 of 15 studies is worse than one that renders 8 and says so. It takes a trial
 * card's cell, so it sits in a row of trial cards as one of them.
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
