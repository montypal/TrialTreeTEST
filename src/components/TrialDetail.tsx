'use client';

import { useEffect, useId, useRef } from 'react';
import type { TrialDTO } from '@/types';
import { TrialSiteMap } from '@/components/TrialSiteMap';
import {
  DisclosureSection,
  GeneratedSummary,
  MetadataSection,
  NotAvailable,
  ProvenanceBadge,
  statusLabel,
  type GeneratedSummaryData,
  type MetadataRow,
  type Provenance,
} from '@/components/trial/MetadataSection';

// ---------------------------------------------------------------------------
// Slide-over panel shown when a trial card is clicked.
//
// Reading order is the priority order: what the study is, what phase it is,
// and where it is open come first and are always visible; identifiers and the
// long stored study text sit behind native disclosures so a phone isn't
// handed six blocks of dense text at once.
//
// The other rule this panel follows: it never lets absence look like
// completeness. Every field we don't hold renders as "Not available", and no
// text claims a source we can't actually prove from the data we were given.
//
// Full-width sheet on phones; 440px from `sm`, widening on large screens now
// that there is more to read. Safe-area insets are 0 on desktop, so the calc()
// paddings below resolve to exactly the old p-5 there.
// ---------------------------------------------------------------------------

/**
 * The plain-language summary, if one has been approved. /api/tree withholds
 * unapproved text entirely, so anything that arrives here has been signed off;
 * the approved flag is still checked rather than assumed, because a flag that
 * gates a clinical claim should fail closed.
 */
function readGeneratedSummary(trial: TrialDTO): GeneratedSummaryData | null {
  const text = trial.summary?.trim() ?? '';
  if (!text) return null;
  const source = trial.summarySource?.trim() ?? '';
  return {
    text,
    sourceLabel: source.length > 0 ? source : null,
    approved: trial.summaryApproved === true,
    generatedAt: trial.summaryGeneratedAt ?? null,
  };
}

/**
 * Where this record's stored text came from, as the database recorded it. The
 * curated loader writes CURATED and the ClinicalTrials.gov importer writes
 * CTGOV; anything else (a hand-entered MANUAL row, or an older producer that
 * never sent the field) is honestly "not recorded" rather than a guess.
 */
function provenanceOf(trial: TrialDTO): Provenance {
  if (trial.source === 'CURATED') return 'curated';
  if (trial.source === 'CTGOV') return 'ctgov';
  return 'unknown';
}

/** Selector for everything Tab can land on inside the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function TrialDetail({ trial, onClose }: { trial: TrialDTO; onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const nctUrl = trial.nctId ? `https://clinicaltrials.gov/study/${trial.nctId}` : null;
  const generated = readGeneratedSummary(trial);
  const studyText = trial.eligibilityCriteria?.trim() ?? '';
  const provenance = provenanceOf(trial);
  // A report link carries the trial with it so the reviewer knows exactly which
  // listing is being questioned, and the reader does not have to describe it.
  const reportHref = `/suggestions?trial=${encodeURIComponent(trial.id)}&name=${encodeURIComponent(
    trial.shorthand ?? trial.title,
  )}`;
  // The example names a site this trial is actually held at. It used to name
  // City of Hope for every study -- a real institution, beside studies that are
  // not open there.
  const exampleSite = trial.locations[0]?.locationName ?? 'the site';

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // On a phone the panel covers everything, so Tab must not wander off into the
  // tree hidden behind it -- it cycles inside the panel. When the panel closes,
  // focus goes back to whatever opened it (the trial card) instead of being
  // dropped at the top of the document.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel?.addEventListener('keydown', onTab);
    return () => {
      panel?.removeEventListener('keydown', onTab);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  // Selecting a different trial reuses this instance, so without this the new
  // trial opens scrolled to wherever the last one was left, and keyboard focus
  // stays back on the tree. preventScroll because the panel is fixed — the
  // browser has nothing useful to scroll it into.
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    bodyRef.current?.scrollTo({ top: 0 });
  }, [trial.id]);

  const metadataRows: MetadataRow[] = [
    {
      label: 'NCT ID',
      value:
        trial.nctId && nctUrl ? (
          <a
            href={nctUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center font-medium text-blue-600 hover:underline sm:min-h-0"
          >
            {trial.nctId} ↗
          </a>
        ) : (
          <NotAvailable note="no NCT ID recorded" />
        ),
    },
    {
      label: 'Protocol / IRB',
      value: trial.protocolNumber ?? <NotAvailable note="no protocol number recorded" />,
    },
    { label: 'Phase', value: trial.phase ?? <NotAvailable note="no phase recorded" /> },
    {
      label: 'Lead investigator',
      value: trial.principalInvestigator ?? (
        <NotAvailable note="none recorded; site investigators are listed above" />
      ),
    },
    { label: 'Short name', value: trial.shorthand ?? <NotAvailable note="no short name recorded" /> },
    { label: 'Sites held', value: String(trial.locations.length) },
    { label: 'Cohorts held', value: String(trial.cohorts.length) },
  ];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="animate-slide-in-right fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl outline-none sm:w-[440px] sm:max-w-[92vw] lg:w-[520px] xl:w-[560px]"
      style={{ paddingRight: 'env(safe-area-inset-right, 0px)' }}
    >
      <div
        className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0 break-words">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-700">
            {trial.phase ?? 'Phase not listed'}
            <span className="text-slate-500"> · {trial.nctId ?? 'No NCT ID'}</span>
          </div>
          <h2 id={titleId} className="mt-1 font-display text-lg font-bold leading-snug text-slate-900">
            {trial.title}
          </h2>
          {trial.shorthand && (
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              {trial.shorthand}
            </div>
          )}
          <div className="mt-1 text-sm text-slate-500">
            {trial.principalInvestigator ? (
              <>Lead PI: {trial.principalInvestigator}</>
            ) : (
              <>Lead PI: <NotAvailable /></>
            )}
          </div>
        </div>
        {/* A 44px square at every width: touch laptops and iPads run lg too, and
            the negative margins keep it from padding out the header. */}
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close trial details"
        >
          ✕
        </button>
      </div>

      <div
        ref={bodyRef}
        className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Where it is open, and whether it is open — the question people
            actually arrive with. */}
        <TrialSiteMap locations={trial.locations} />

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cohorts</h3>
          {trial.cohorts.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trial.cohorts.map((c) => (
                <span key={c.id} className={`pill pill-${c.status}`}>
                  {c.label} · {statusLabel(c.status)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm">
              <NotAvailable note="no cohorts recorded for this study" />
            </p>
          )}
        </section>

        {/* Either the generated summary (which keeps the stored text one click
            away inside it) or the stored text itself — never both, so the same
            paragraphs don't appear twice in one panel. */}
        {generated ? (
          <GeneratedSummary summary={generated} sourceText={studyText || null} sourceProvenance={provenance} />
        ) : (
          <StoredStudyText text={studyText} provenance={provenance} />
        )}

        {nctUrl ? (
          <a
            href={nctUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto lg:min-h-0 lg:py-2"
          >
            View on ClinicalTrials.gov ↗
          </a>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            No NCT ID is recorded for this study, so there is no ClinicalTrials.gov page to link to.
            Ask the study team at the site for the protocol.
          </p>
        )}

        <DisclosureSection title="Study identifiers & details" hint="as held in TrialTree">
          <MetadataSection rows={metadataRows} />
        </DisclosureSection>

        <p className="text-xs leading-relaxed text-slate-500">
          TrialTree is a directory, not medical advice. Confirm eligibility against the full protocol
          and the study team before acting.
        </p>

        <a
          href={reportHref}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
        >
          Report a problem with this listing
        </a>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Clinicians at participating sites can update a listing by text, for example &ldquo;Close{' '}
          {trial.shorthand ?? 'this trial'} at {exampleSite}&rdquo;, and an approved change updates
          this board in real time.
        </div>
      </div>
    </div>
  );
}

/**
 * The single free-text block TrialTree stores per trial. The curated loader
 * packs setting + summary + site notes into it (src/lib/tree/curated.ts); a
 * ClinicalTrials.gov import puts a trimmed eligibility excerpt there
 * (src/lib/ctgov/import.ts). Trial.source says which, and the badge follows
 * it. The heading still avoids calling this "eligibility criteria", which it
 * usually is not.
 *
 * Short blocks open by default; long ones stay collapsed so the panel doesn't
 * open as a wall of text on a phone.
 */
function StoredStudyText({ text, provenance }: { text: string; provenance: Provenance }) {
  if (!text) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Study description</h3>
        <p className="mt-1.5 text-sm">
          <NotAvailable note="no description or eligibility text is stored for this study" />
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          The ClinicalTrials.gov record, where one exists, is the fuller source.
        </p>
      </div>
    );
  }

  return (
    <DisclosureSection
      title="Study description & eligibility text"
      badge={<ProvenanceBadge provenance={provenance} />}
      defaultOpen={text.length <= 420}
    >
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{text}</p>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">
        {provenance === 'curated'
          ? 'Transcribed by hand from the site\u2019s own trial list. It is a summary, not the full eligibility criteria.'
          : provenance === 'ctgov'
            ? 'An excerpt imported from the ClinicalTrials.gov record. It is not the full eligibility criteria.'
            : 'The source of this text was not recorded. It is not the full eligibility criteria.'}
      </p>
    </DisclosureSection>
  );
}
