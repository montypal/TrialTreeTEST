'use client';

import { useEffect, useId, useRef } from 'react';
import type { CtgovOfficialDTO, RecruitmentStatus, TrialDTO, TrialLocationDTO } from '@/types';
import { TrialSiteMap } from '@/components/TrialSiteMap';
import { DOT, hueFor } from '@/lib/cancerColors';
import {
  DisclosureSection,
  MetadataSection,
  NCT_PENDING,
  NotAvailable,
  ProvenanceBadge,
  formatIsoDate,
  registryStatusLabel,
  statusLabel,
  type MetadataRow,
  type Provenance,
} from '@/components/trial/MetadataSection';

// ---------------------------------------------------------------------------
// Slide-over panel shown when a trial card is clicked.
//
// Reading order is the priority order, so the study can be understood in
// about five seconds: what it is (title, shorthand), whether it is open and
// at what phase, then "At a glance" — the drug, how it works, one sentence on
// what is being tested, and the disease it sits under. Where it is running,
// the ClinicalTrials.gov record and the long stored text follow, the last of
// them behind a native disclosure so a phone isn't handed a wall of text.
//
// Honesty rules: an At a glance row with no value is left out rather than
// padded with a placeholder, but a missing NCT number or PI is always said
// out loud, in one fixed wording (MetadataSection), because those are the two
// things a reader goes looking for. No text claims a source the data does not
// record, and the registry's status is never shown as if it were a center's.
//
// Full-width sheet on phones; 440px from `sm`, widening on large screens now
// that there is more to read. Safe-area insets are 0 on desktop, so the calc()
// paddings below resolve to exactly the old p-5 there.
// ---------------------------------------------------------------------------

/** Trimmed text, or null for null / undefined / whitespace-only values. */
function present(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  return text.length > 0 ? text : null;
}

/**
 * Where the one-sentence summary came from, in the reader's words. Only the
 * two producers TrialTree actually has get a source line that names one;
 * anything else is labelled for what it is or as unrecorded, never guessed.
 */
function summaryBasis(source: string | null | undefined): string {
  switch (present(source)?.toUpperCase()) {
    case 'CTGOV':
      return 'Based on the ClinicalTrials.gov record';
    case 'CURATED':
      return 'Based on the center’s trial list';
    case 'AI_GENERATED':
      return 'Machine-written summary; check it against the full protocol';
    default:
      return 'Source not recorded';
  }
}

/**
 * The approved summary, if there is one. /api/tree sends the text only once a
 * human has approved it, so its presence is the approval; an explicit
 * `summaryApproved: false` is still refused here, because a flag that gates a
 * clinical claim should fail closed whenever it is actually present.
 */
function readSummary(trial: TrialDTO): { text: string; basis: string } | null {
  const text = present(trial.summary);
  if (!text || trial.summaryApproved === false) return null;
  return { text, basis: summaryBasis(trial.summarySource) };
}

type SourceLink = { href: string; label: string; srDetail: string | null };

/**
 * mechanismSources -> links a reader can check the mechanism against. Only
 * the two recorded forms are understood ("NCIT:C135627", "CTGOV:NCT01234567");
 * anything else is dropped rather than turned into a link to nowhere.
 */
function mechanismSourceLinks(sources: string[] | null | undefined): SourceLink[] {
  const links: SourceLink[] = [];
  const seen = new Set<string>();
  for (const raw of sources ?? []) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    const ncit = /^NCIT:(C\d+)$/i.exec(value);
    const ctgov = /^CTGOV:(NCT\d{8})$/i.exec(value);
    let link: SourceLink | null = null;
    if (ncit) {
      const code = ncit[1].toUpperCase();
      link = {
        href: `https://ncit.nci.nih.gov/ncitbrowser/ConceptReport.jsp?dictionary=NCI_Thesaurus&code=${code}`,
        label: `NCI Thesaurus ${code}`,
        srDetail: null,
      };
    } else if (ctgov) {
      const nct = ctgov[1].toUpperCase();
      link = { href: `https://clinicaltrials.gov/study/${nct}`, label: 'ClinicalTrials.gov', srDetail: `record ${nct}` };
    }
    if (link && !seen.has(link.href)) {
      seen.add(link.href);
      links.push(link);
    }
  }
  return links;
}

// Most hopeful first: a study recruiting at one center and closed at another
// is, to a reader, recruiting — at that one center, which the line then says.
const STATUS_PRIORITY: RecruitmentStatus[] = ['RECRUITING', 'WAITLISTED', 'SUSPENDED', 'CLOSED'];

/** The header's status line, read from the centers' own statuses. */
function siteStatusSummary(
  locations: TrialLocationDTO[],
): { status: RecruitmentStatus; where: string } | null {
  const total = locations.length;
  if (total === 0) return null;
  for (const status of STATUS_PRIORITY) {
    const count = locations.filter((l) => l.status === status).length;
    if (count === 0) continue;
    const where =
      total === 1
        ? `at ${locations[0].locationName}`
        : count === total
          ? `at all ${total} sites`
          : `at ${count} of ${total} sites`;
    return { status, where };
  }
  return null;
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

export type TrialDetailProps = {
  trial: TrialDTO;
  onClose: () => void;
  /**
   * The trial's place in the tree, in full ("Prostate Cancer › Metastatic
   * castration-resistant (mCRPC)"). Optional so a caller without the tree's
   * nodes still compiles; the Disease row is simply left out without it.
   */
  disease?: string | null;
};

export function TrialDetail({ trial, onClose, disease = null }: TrialDetailProps) {
  const titleId = useId();
  const glanceId = useId();
  const registryId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const nctId = present(trial.nctId);
  const nctUrl = nctId ? `https://clinicaltrials.gov/study/${nctId}` : null;
  const shorthand = present(trial.shorthand);
  // Most curated titles already lead with their shorthand ("URO-PRO: …"), so it
  // is only repeated above the title when the title doesn't carry it.
  const showShorthand = shorthand !== null && !trial.title.toLowerCase().includes(shorthand.toLowerCase());
  const phase = present(trial.phase);
  const siteStatus = siteStatusSummary(trial.locations);

  const intervention = present(trial.intervention);
  const mechanism = present(trial.mechanism);
  const mechanismLinks = mechanism ? mechanismSourceLinks(trial.mechanismSources) : [];
  const summary = readSummary(trial);
  const diseaseLabel = present(disease);
  // The cancer is the first level of the label; its ribbon colour is the same
  // one the tree uses, so the dot ties this panel back to where the card sat.
  const diseaseHue = hueFor(diseaseLabel?.split(' › ')[0]);

  const studyText = trial.eligibilityCriteria?.trim() ?? '';
  const provenance = provenanceOf(trial);
  const ctgov = trial.ctgov ?? null;
  const checkedOn = ctgov ? formatIsoDate(ctgov.checkedAt) : null;
  const autoMatched = nctId !== null && trial.nctSource === 'AUTO_MATCHED';
  const matchNote = present(trial.nctMatchNote);
  const leadPi = present(trial.principalInvestigator);

  // A report link carries the trial with it so the reviewer knows exactly which
  // listing is being questioned, and the reader does not have to describe it.
  const reportHref = `/suggestions?trial=${encodeURIComponent(trial.id)}&name=${encodeURIComponent(
    trial.shorthand ?? trial.title,
  )}`;

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

  // ---- At a glance: only rows we hold a value for --------------------------
  const glanceRows: MetadataRow[] = [];
  if (intervention) {
    glanceRows.push({
      label: 'Drug / intervention',
      value: <span className="font-semibold text-slate-900">{intervention}</span>,
    });
  }
  if (mechanism) {
    glanceRows.push({
      label: 'Mechanism of action',
      value: (
        <>
          <div>{mechanism}</div>
          {mechanismLinks.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-x-3">
              {mechanismLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center text-xs font-semibold text-blue-600 hover:underline sm:min-h-0 sm:py-1"
                >
                  {link.label}
                  <span aria-hidden="true">&nbsp;↗</span>
                  <span className="sr-only">
                    {link.srDetail ? ` ${link.srDetail}` : ''} (opens in a new tab)
                  </span>
                </a>
              ))}
            </div>
          )}
        </>
      ),
    });
  }
  if (summary) {
    glanceRows.push({
      label: 'Summary',
      value: (
        <>
          <p>{summary.text}</p>
          <p className="mt-1 text-xs text-slate-500">{summary.basis}</p>
        </>
      ),
    });
  }
  if (diseaseLabel) {
    glanceRows.push({
      label: 'Disease',
      value: (
        <>
          <span
            aria-hidden="true"
            className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${DOT[diseaseHue]}`}
          />
          {diseaseLabel}
        </>
      ),
    });
  }

  // ---- The ClinicalTrials.gov record ---------------------------------------
  // The NCT row always renders: a missing number is said, never left blank.
  const registryRows: MetadataRow[] = [
    {
      label: 'NCT number',
      value:
        nctId && nctUrl ? (
          <>
            <a
              href={nctUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center font-semibold text-blue-700 hover:underline sm:min-h-0"
            >
              {nctId}
              <span aria-hidden="true">&nbsp;↗</span>
              <span className="sr-only"> on ClinicalTrials.gov (opens in a new tab)</span>
            </a>
            {autoMatched && (
              <span className="block text-xs text-slate-500">
                {matchNote ? `Matched automatically on ${matchNote}` : 'Matched automatically'}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="block font-semibold text-slate-700">{NCT_PENDING}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
              Not yet linked to a ClinicalTrials.gov record. A number appears here only once it has been
              verified.
            </span>
          </>
        ),
    },
  ];
  if (ctgov) {
    const registryStatus = present(ctgov.overallStatus);
    if (registryStatus) {
      registryRows.push({ label: 'Registry status', value: registryStatusLabel(registryStatus) });
    }
    const sponsor = present(ctgov.sponsor);
    if (sponsor) registryRows.push({ label: 'Sponsor', value: sponsor });
    // ctgovOfficials is a Json column, so each entry is checked rather than
    // trusted to have the shape the type promises.
    const allOfficials: CtgovOfficialDTO[] = Array.isArray(ctgov.officials) ? ctgov.officials : [];
    const officials = allOfficials.filter(
      (o) => o != null && typeof o.name === 'string' && o.name.trim().length > 0,
    );
    if (officials.length > 0) {
      registryRows.push({
        label: 'Study leadership',
        value: (
          <ul className="space-y-1.5">
            {officials.map((o, i) => {
              const detail = [present(o.role), present(o.affiliation)]
                .filter((part): part is string => part !== null)
                .join(', ');
              return (
                <li key={`${o.name}-${i}`}>
                  <span className="font-medium text-slate-800">{o.name.trim()}</span>
                  {detail.length > 0 ? <span className="block text-xs text-slate-500">{detail}</span> : null}
                </li>
              );
            })}
          </ul>
        ),
      });
    }
  }

  // ---- Identifiers, as held in TrialTree -----------------------------------
  const identifierRows: MetadataRow[] = [
    { label: 'NCT number', value: nctId ?? <span className="italic text-slate-500">{NCT_PENDING}</span> },
    {
      label: 'Protocol / IRB',
      value: present(trial.protocolNumber) ?? <NotAvailable note="no protocol number recorded" />,
    },
    { label: 'Phase', value: phase ?? <NotAvailable note="no phase recorded" /> },
    // Curated lists name each site's PI, not a lead PI, so this row only
    // appears for a record that actually holds one.
    ...(leadPi ? [{ label: 'Lead investigator (ClinicalTrials.gov)', value: leadPi }] : []),
    { label: 'Short name', value: shorthand ?? <NotAvailable note="no short name recorded" /> },
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
          {showShorthand && (
            <div className="text-xs font-bold uppercase tracking-widest text-blue-700">{shorthand}</div>
          )}
          <h2 id={titleId} className="mt-1 font-display text-lg font-bold leading-snug text-slate-900">
            {trial.title}
          </h2>
          {/* The centers' own status. The registry's status is a different
              claim, and is kept to its own labelled block below. */}
          {(siteStatus || phase) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
              {siteStatus && (
                <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className={`pill pill-${siteStatus.status}`}>{statusLabel(siteStatus.status)}</span>
                  <span>{siteStatus.where}</span>
                </span>
              )}
              {siteStatus && phase && (
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
              )}
              {phase && <span className="font-semibold text-slate-700">{phase}</span>}
            </div>
          )}
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
        {/* The five-second read. Stacked rather than two-column: the panel is
            a phone's width, and a label column would squeeze the values. */}
        {glanceRows.length > 0 && (
          <section aria-labelledby={glanceId}>
            <h3 id={glanceId} className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              At a glance
            </h3>
            <dl className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-4">
              {glanceRows.map((row) => (
                <div key={row.label} className="py-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</dt>
                  <dd className="m-0 mt-1 min-w-0 break-words text-sm leading-relaxed text-slate-700">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Where it is open, and whether it is open — the question people
            actually arrive with. */}
        <TrialSiteMap locations={trial.locations} />

        {trial.cohorts.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cohorts</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trial.cohorts.map((c) => (
                <span key={c.id} className={`pill pill-${c.status}`}>
                  {c.label} · {statusLabel(c.status)}
                </span>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby={registryId}>
          <h3 id={registryId} className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            ClinicalTrials.gov record
          </h3>
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
            <MetadataSection rows={registryRows} />
            {ctgov && (
              <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">
                {checkedOn ? `Checked ${checkedOn}. ` : null}
                These are the registry&rsquo;s own facts, separate from each center&rsquo;s status above.
              </p>
            )}
          </div>
        </section>

        <StoredStudyText text={studyText} provenance={provenance} />

        <DisclosureSection title="Study identifiers & details" hint="as held in TrialTree">
          <MetadataSection rows={identifierRows} />
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
 * Collapsed by default now that At a glance carries the one-sentence summary,
 * and left out entirely when nothing is stored, so the five-second read is
 * never followed by a box that only says there is nothing in it.
 */
function StoredStudyText({ text, provenance }: { text: string; provenance: Provenance }) {
  if (!text) return null;

  return (
    <DisclosureSection
      title="Study description & eligibility text"
      badge={<ProvenanceBadge provenance={provenance} />}
    >
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{text}</p>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">
        {provenance === 'curated'
          ? 'Transcribed by hand from the site’s own trial list. It is a summary, not the full eligibility criteria.'
          : provenance === 'ctgov'
            ? 'An excerpt imported from the ClinicalTrials.gov record. It is not the full eligibility criteria.'
            : 'The source of this text was not recorded. It is not the full eligibility criteria.'}
      </p>
    </DisclosureSection>
  );
}
