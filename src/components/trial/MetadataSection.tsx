import { Fragment, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// The small shared pieces the trial panel is built from: provenance badges,
// the fixed wordings for a missing NCT or PI, the "Not available" state, the
// disclosure wrapper and the identifier list.
//
// They live in one file on purpose. The panel's honesty rules only hold if
// they are applied uniformly — a field we don't have must always *look* like a
// field we don't have, and a claim about where a value came from must always
// be made the same way. Scattering these across components is how a clinical
// UI quietly starts implying it knows more than it does.
// ---------------------------------------------------------------------------

/**
 * The two absences a reader actively looks for, each said one way only,
 * everywhere. "Not found" or "not listed" would read as a fact about the
 * study; these say what is actually true — we have not confirmed it yet.
 */
export const NCT_PENDING = 'NCT number pending verification';
export const PI_UNAVAILABLE = 'Principal Investigator information unavailable';

/**
 * Where a piece of text on the panel came from.
 *
 * Read from `Trial.source` (sent on TrialDTO): CURATED -> curated, CTGOV ->
 * ctgov. `unknown` is not a failure state — it is the honest answer for a
 * MANUAL row or a producer that never recorded a source. We say that rather
 * than guess.
 */
export type Provenance = 'curated' | 'ctgov' | 'generated' | 'unknown';

// Tailwind's JIT only sees class names written out in full, so every variant is
// a literal string (same idiom as src/lib/cancerColors.ts). Green is skipped
// throughout — it means "recruiting" everywhere else in the product.
const PROVENANCE_CLASS: Record<Provenance, string> = {
  curated: 'bg-blue-50 text-blue-700 ring-blue-200',
  ctgov: 'bg-slate-100 text-slate-700 ring-slate-300',
  generated: 'bg-amber-50 text-amber-800 ring-amber-300',
  unknown: 'bg-slate-50 text-slate-500 ring-slate-200',
};

const PROVENANCE_LABEL: Record<Provenance, string> = {
  curated: 'TrialTree curated',
  ctgov: 'ClinicalTrials.gov',
  generated: 'Generated summary',
  unknown: 'Source not recorded',
};

const PROVENANCE_HINT: Record<Provenance, string> = {
  curated: 'Transcribed by the TrialTree team from the center’s own study list.',
  ctgov: 'Imported from the public ClinicalTrials.gov record for this study.',
  generated: 'Written by a language model from the stored study text. Not a clinical source.',
  unknown:
    'The trial record does not mark this text as curated from a center’s list or imported from ClinicalTrials.gov, so its source is not shown.',
};

export function ProvenanceBadge({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ring-1 ${PROVENANCE_CLASS[provenance]} ${className ?? ''}`}
      title={PROVENANCE_HINT[provenance]}
    >
      {PROVENANCE_LABEL[provenance]}
      {/* The visible label is short; screen readers get the full explanation,
          which is the part that actually carries the caveat. */}
      <span className="sr-only"> — {PROVENANCE_HINT[provenance]}</span>
    </span>
  );
}

/** "RECRUITING" -> "Recruiting". Shared so every status reads the same way. */
export function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * ClinicalTrials.gov's overallStatus values, worded the way the registry
 * itself displays them. A Map rather than an object, so a stray value such as
 * "constructor" can never resolve to something off the prototype.
 */
const REGISTRY_STATUS = new Map<string, string>([
  ['RECRUITING', 'Recruiting'],
  ['ACTIVE_NOT_RECRUITING', 'Active, not recruiting'],
  ['NOT_YET_RECRUITING', 'Not yet recruiting'],
  ['ENROLLING_BY_INVITATION', 'Enrolling by invitation'],
  ['COMPLETED', 'Completed'],
  ['SUSPENDED', 'Suspended'],
  ['TERMINATED', 'Terminated'],
  ['WITHDRAWN', 'Withdrawn'],
  ['AVAILABLE', 'Available (expanded access)'],
  ['NO_LONGER_AVAILABLE', 'No longer available'],
  ['TEMPORARILY_NOT_AVAILABLE', 'Temporarily not available'],
  ['APPROVED_FOR_MARKETING', 'Approved for marketing'],
  ['UNKNOWN', 'Unknown status'],
]);

/**
 * A registry status as a reader would say it. A value the registry adds later
 * is title-cased as given ("SOME_NEW_STATUS" -> "Some New Status") rather than
 * mapped onto a status we think is close: close is not the same claim.
 */
export function registryStatusLabel(raw: string): string {
  const value = raw.trim();
  const known = REGISTRY_STATUS.get(value.toUpperCase().replace(/[\s-]+/g, '_'));
  if (known) return known;
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * The way the identifier list renders a value it does not have. There, a
 * missing row would read as "nothing to say here", which is a different claim
 * from "we don't know". (The "At a glance" rows work the other way round: a
 * row with no value is left out, so the five-second read is never padded.)
 * Never use this for an NCT or a PI — those have their own wording above.
 */
export function NotAvailable({ note }: { note?: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 text-slate-500">
      <span className="italic">Not available</span>
      {note ? <span className="text-xs">({note})</span> : null}
    </span>
  );
}

/**
 * Native <details>/<summary>. Keyboard operation, the open/closed state and
 * the screen-reader semantics are the browser's job — a div pretending to be a
 * disclosure would have to reimplement all three, badly.
 */
export function DisclosureSection({
  title,
  badge,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: ReactNode;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white" open={defaultOpen}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-words text-sm font-semibold text-slate-800">{title}</span>
          {badge}
          {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180"
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-slate-100 px-4 py-3">{children}</div>
    </details>
  );
}

export type MetadataRow = {
  label: string;
  /** In the identifier list, pass <NotAvailable /> rather than leaving a row out. */
  value: ReactNode;
};

/**
 * A label/value block (identifiers, the ClinicalTrials.gov record). It is a
 * real <dl>, so the label/value pairing survives into the accessibility tree
 * instead of being a visual coincidence.
 */
export function MetadataSection({ rows }: { rows: MetadataRow[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
      {rows.map((row) => (
        <Fragment key={row.label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</dt>
          <dd className="m-0 min-w-0 break-words text-sm text-slate-700 sm:mt-px">{row.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formatted in UTC with a fixed month table rather than toLocaleDateString:
 * the panel can be rendered on a kiosk, a phone and a server, and a date that
 * shifts by a day between them is a data-integrity problem, not a nicety.
 */
export function formatIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCDate()} ${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}
