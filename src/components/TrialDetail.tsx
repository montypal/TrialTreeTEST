'use client';

import type { TrialDTO } from '@/types';

const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

// Slide-over panel shown when a trial card is clicked. Full details + a link to
// the real ClinicalTrials.gov study page.
export function TrialDetail({ trial, onClose }: { trial: TrialDTO; onClose: () => void }) {
  const nctUrl = trial.nctId ? `https://clinicaltrials.gov/study/${trial.nctId}` : null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[440px] max-w-[92vw] flex-col border-l border-slate-700 bg-slate-950/95 shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-5">
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-blue-300">
            {trial.phase ?? 'Trial'}
            {trial.nctId ? ` · ${trial.nctId}` : ''}
          </div>
          <h2 className="mt-1 text-lg font-bold leading-snug text-slate-50">{trial.title}</h2>
          {trial.principalInvestigator && (
            <div className="mt-1 text-sm text-slate-400">Lead PI: {trial.principalInvestigator}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sites &amp; status
          </h3>
          <ul className="mt-2 space-y-1.5">
            {trial.locations.map((l) => (
              <li
                key={l.locationSlug}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-slate-200">{l.locationName}</div>
                  <div className="text-xs text-slate-500">
                    {l.piName ? (
                      <>Site PI: {l.piName}</>
                    ) : (
                      <span className="italic">Site investigator not listed on CT.gov</span>
                    )}
                  </div>
                </div>
                <span className={`pill pill-${l.status} shrink-0`}>{cap(l.status)}</span>
              </li>
            ))}
          </ul>
        </section>

        {trial.cohorts.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cohorts</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trial.cohorts.map((c) => (
                <span key={c.id} className={`pill pill-${c.status}`}>
                  {c.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {trial.eligibilityCriteria && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Eligibility
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {trial.eligibilityCriteria}
            </p>
          </section>
        )}

        {nctUrl && (
          <a
            href={nctUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            View on ClinicalTrials.gov ↗
          </a>
        )}

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
          Clinicians update this by text — e.g. “Close {trial.shorthand ?? 'this trial'} at City of
          Hope” — and this board updates in real time.
        </div>
      </div>
    </div>
  );
}
