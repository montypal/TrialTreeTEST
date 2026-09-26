import type { ReactNode } from 'react';
import type { RecruitmentStatus, TrialLocationDTO } from '@/types';
import { CENTERS, centerBySlug } from '@/lib/locations';
import { NotAvailable, statusLabel } from '@/components/trial/MetadataSection';

// ---------------------------------------------------------------------------
// "Where this study is running" — the geographic panel inside the trial
// detail sheet.
//
// There is no mapping provider configured and TrialTree stores no coordinates
// for its centers (src/lib/locations.ts holds slug / name / shortName /
// aliases and nothing else), so this deliberately does NOT draw a map. Faking
// pins on a clinical site would be worse than having none: a patient would
// drive to them.
//
// What it does instead is give the real, complete site list the shape a map
// panel has — one framed locator area, then a scannable list of sites with
// their own status — so that when a tile layer does arrive it drops into the
// `mapSlot` seam below and nothing else has to move.
//
// No hooks, no handlers: this stays server-safe so it can be reused outside
// the client-only detail panel.
// ---------------------------------------------------------------------------

export type TrialSiteMapProps = {
  locations: TrialLocationDTO[];
  /**
   * THE SEAM. Pass a rendered map (tile layer + markers) and it replaces the
   * placeholder; the site list underneath is unchanged either way. Nothing
   * passes this today — see the placeholder copy for what is missing.
   */
  mapSlot?: ReactNode;
  className?: string;
};

// Literal class strings only — Tailwind's JIT can't see interpolated names.
// Same marks as the tree cards (TrialNode's SITE_DOT), so the two surfaces
// agree — and each differs in shape as well as hue: filled, ringed, hollow. A
// colour-blind reader can still tell a recruiting site from a closed one.
const STATUS_DOT: Record<RecruitmentStatus, string> = {
  RECRUITING: 'bg-emerald-500',
  WAITLISTED: 'bg-amber-400 ring-1 ring-amber-700',
  CLOSED: 'border border-slate-500 bg-transparent',
  SUSPENDED: 'bg-rose-500 ring-1 ring-rose-800',
};

export function TrialSiteMap({ locations, mapSlot, className }: TrialSiteMapProps) {
  const total = locations.length;
  const recruitingCount = locations.filter((l) => l.status === 'RECRUITING').length;

  // Status per center, so the locator chips can carry the same status colour
  // the cards do. First entry wins; a trial has one row per center.
  const statusBySlug = new Map<string, RecruitmentStatus>();
  for (const l of locations) {
    if (!statusBySlug.has(l.locationSlug)) statusBySlug.set(l.locationSlug, l.status);
  }

  const summary =
    total === 0
      ? 'No sites listed'
      : `${recruitingCount} of ${total} listed site${total === 1 ? '' : 's'} recruiting`;

  return (
    <section aria-label="Where this study is running" className={className}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Where this study is running
        </h3>
        <p className="text-xs font-semibold text-slate-600">{summary}</p>
      </header>

      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {mapSlot ? <div className="min-h-[10rem]">{mapSlot}</div> : <MapPlaceholder statusBySlug={statusBySlug} />}
      </div>

      {total === 0 ? (
        <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          No sites are recorded for this study in TrialTree. That means none are held here — not that
          the study is running nowhere. Check the ClinicalTrials.gov record below.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {locations.map((l) => (
            <SiteCard key={l.locationSlug} location={l} />
          ))}
        </ul>
      )}

      <p className="mt-2 text-[0.7rem] leading-relaxed text-slate-500">
        Status and investigator are held per site. Open-slot counts appear only for sites that report
        one; no count means none is recorded.
      </p>
    </section>
  );
}

function SiteCard({ location }: { location: TrialLocationDTO }) {
  const center = centerBySlug(location.locationSlug);
  // Search by name, not by coordinate — we have a real institution name and no
  // real position, and a search is the honest version of that.
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.locationName)}`;

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 break-words">
          <div className="text-sm font-semibold text-slate-800">{location.locationName}</div>
          {center && center.shortName !== center.name ? (
            <div className="text-[0.7rem] uppercase tracking-wide text-slate-500">{center.shortName}</div>
          ) : null}
        </div>
        <span className={`pill pill-${location.status} shrink-0`}>{statusLabel(location.status)}</span>
      </div>

      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex flex-wrap gap-x-1.5">
          <dt className="text-slate-500">Site investigator:</dt>
          <dd className="m-0 min-w-0 break-words text-slate-700">
            {location.piName ?? <NotAvailable note="none recorded for this site" />}
          </dd>
        </div>
        {location.slotsOpen !== null && (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-slate-500">Open slots:</dt>
            <dd className="m-0 text-slate-700">{location.slotsOpen}</dd>
          </div>
        )}
      </dl>

      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Search Google Maps for ${location.locationName} (opens in a new tab)`}
        className="mt-1 inline-flex min-h-[44px] items-center text-xs font-semibold text-blue-600 hover:underline sm:min-h-0 sm:py-1"
      >
        Find this center on a map ↗
      </a>
    </li>
  );
}

/**
 * Stands in for the map. It says plainly that there isn't one and why, then
 * gives the only locator we can honestly draw: which of the centers TrialTree
 * tracks are running this study.
 */
function MapPlaceholder({ statusBySlug }: { statusBySlug: Map<string, RecruitmentStatus> }) {
  return (
    <div>
      <div className="border-b border-dashed border-slate-300 bg-slate-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Map view — placeholder, requires review before launch
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          No mapping provider is configured and TrialTree holds no coordinates for its centers, so no
          map is drawn here. The sites listed below are the complete set held for this study.
        </p>
      </div>

      <div className="px-4 py-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-wide text-slate-500">
          Southern California network
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {CENTERS.map((c) => {
            const status = statusBySlug.get(c.slug);
            return (
              <li key={c.slug}>
                {status ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`}
                    />
                    {c.shortName}
                    <span className="sr-only">
                      {' '}
                      — {statusLabel(status)} at {c.name}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                    {c.shortName}
                    <span className="sr-only"> — this study is not listed at {c.name}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[0.7rem] leading-relaxed text-slate-500">
          Solid chips are centers running this study. Dashed chips are the other centers TrialTree
          tracks, where it is not listed.
        </p>
      </div>
    </div>
  );
}
