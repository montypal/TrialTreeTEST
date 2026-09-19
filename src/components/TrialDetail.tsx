'use client';

import { useEffect } from 'react';
import type { TrialDTO } from '@/types';

const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

// Slide-over panel shown when a trial card is clicked. Full details + a link to
// the real ClinicalTrials.gov study page. Full-width sheet on phones; a 440px
// panel from `sm` up. Safe-area insets are 0 on desktop, so the calc() paddings
// below resolve to exactly the old p-5 there.
export function TrialDetail({ trial, onClose }: { trial: TrialDTO; onClose: () => void }) {
  const nctUrl = trial.nctId ? `https://clinicaltrials.gov/study/${trial.nctId}` : null;

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="animate-slide-in-right fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[440px] sm:max-w-[92vw]"
      style={{ paddingRight: 'env(safe-area-inset-right, 0px)' }}
    >
      <div
        className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0 break-words">
          <div className="text-[0.65rem] font-bold uppercase tracking-widest text-blue-600">
            {trial.phase ?? 'Trial'}
            {trial.nctId ? ` · ${trial.nctId}` : ''}
          </div>
          <h2 className="mt-1 font-display text-lg font-bold leading-snug text-slate-900">{trial.title}</h2>
          {trial.principalInvestigator && (
            <div className="mt-1 text-sm text-slate-500">Lead PI: {trial.principalInvestigator}</div>
          )}
        </div>
        {/* 44px touch target below lg; lg restores the original compact button. */}
        <button
          onClick={onClose}
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:mr-0 lg:mt-0 lg:block lg:h-auto lg:w-auto"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div
        className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sites &amp; status
          </h3>
          <ul className="mt-2 space-y-1.5">
            {trial.locations.map((l) => (
              <li
                key={l.locationSlug}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1 break-words">
                  <div className="text-sm font-medium text-slate-800">{l.locationName}</div>
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
              About this trial
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {trial.eligibilityCriteria}
            </p>
          </section>
        )}

        {nctUrl && (
          <a
            href={nctUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 lg:py-2"
          >
            View on ClinicalTrials.gov ↗
          </a>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Clinicians update this by text — e.g. “Close {trial.shorthand ?? 'this trial'} at City of
          Hope” — and this board updates in real time.
        </div>
      </div>
    </div>
  );
}
