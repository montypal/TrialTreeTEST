import { Fragment, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// The small shared pieces the trial panel is built from: provenance badges,
// the "Not available" state, the disclosure wrapper and the identifier list.
//
// They live in one file on purpose. The panel's honesty rules only hold if
// they are applied uniformly — a field we don't have must always *look* like a
// field we don't have, and a claim about where a value came from must always
// be made the same way. Scattering these across components is how a clinical
// UI quietly starts implying it knows more than it does.
// ---------------------------------------------------------------------------

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
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide ring-1 ${PROVENANCE_CLASS[provenance]} ${className ?? ''}`}
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
 * The one way this panel renders a value it does not have. Never omit a field
 * silently: on a clinical site, a missing row reads as "nothing to say here",
 * which is a different claim from "we don't know".
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
  /** Pass <NotAvailable /> rather than null — the row must still be rendered. */
  value: ReactNode;
};

/**
 * The dense identifier block (NCT, protocol/IRB, phase, lead PI …). It is a
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

/**
 * What the panel needs in order to show a machine-written summary.
 *
 * Fed from Trial.summary / summarySource / summaryApproved /
 * summaryGeneratedAt via TrialDTO. /api/tree and /api/assistant send the text
 * only once summaryApproved is true, so an unreviewed summary never reaches
 * this block. Nothing writes summaries yet — the block renders once one has
 * been generated and approved.
 */
export type GeneratedSummaryData = {
  text: string;
  /** Whatever produced it, as recorded (e.g. a model name). Never inferred. */
  sourceLabel: string | null;
  /** Mirrors Trial.summaryApproved exactly — we do not interpret it further. */
  approved: boolean;
  generatedAt: string | null;
};

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

/**
 * A generated summary is shown as a clearly-marked secondary reading of the
 * study, never as the study record itself: it is visually set apart, it says
 * what made it, it says whether a human has signed it off, and the text it was
 * drawn from stays one click away so the reader can check it.
 */
export function GeneratedSummary({
  summary,
  sourceText,
  sourceProvenance = 'unknown',
}: {
  summary: GeneratedSummaryData;
  sourceText?: string | null;
  sourceProvenance?: Provenance;
}) {
  const generatedOn = formatIsoDate(summary.generatedAt);

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Generated summary">
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceBadge provenance="generated" />
        {summary.sourceLabel ? (
          <span className="text-xs text-amber-900">{summary.sourceLabel}</span>
        ) : (
          <span className="text-xs italic text-amber-800">Generator not recorded</span>
        )}
      </div>

      <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
        {summary.text}
      </p>

      <p className="mt-3 text-xs font-semibold text-amber-900">
        Generated summary — review the full protocol before acting on it.
      </p>

      <ul className="mt-1.5 space-y-0.5 text-[0.7rem] text-amber-900/80">
        <li>
          {summary.approved
            ? 'Marked approved in TrialTree.'
            : 'Not marked approved in TrialTree — no one has signed this off.'}
        </li>
        <li>{generatedOn ? `Generated ${generatedOn}.` : 'Generation date not recorded.'}</li>
      </ul>

      {sourceText ? (
        <details className="group mt-3">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-xs font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2 sm:min-h-0 [&::-webkit-details-marker]:hidden">
            Show the stored text this was drawn from
            <ProvenanceBadge provenance={sourceProvenance} />
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words border-t border-amber-200 pt-2 text-xs leading-relaxed text-slate-700">
            {sourceText}
          </p>
        </details>
      ) : (
        <p className="mt-3 text-[0.7rem] text-amber-900/80">
          No study text is stored for this trial, so the summary cannot be checked against a source here.
        </p>
      )}
    </section>
  );
}
