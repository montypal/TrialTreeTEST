'use client';

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Verification screen for proposed ClinicalTrials.gov links.
//
// The whole point of this page is to make it FAST to check a proposal and
// costly to rubber-stamp one. So the TrialTree trial and the candidate record
// sit side by side, the reasoning is written out in sentences rather than as a
// score, the CT.gov record is one click away, and Confirm — the only action
// that writes anything to a trial — takes a second, deliberate click.
// ---------------------------------------------------------------------------

type EvidencePoint = { label: string; value: number };

type Proposal = {
  id: string;
  nctId: string;
  candidateTitle: string;
  confidence: number;
  createdAt: string;
  ctgovUrl: string;
  evidenceLines: string[];
  points: EvidencePoint[];
  trial: {
    id: string;
    title: string;
    protocolNumber: string | null;
    shorthand: string | null;
    phase: string | null;
    principalInvestigator: string | null;
    nctId: string | null;
    centers: string[];
  };
};

type Reviewed = {
  id: string;
  nctId: string;
  status: string;
  confidence: number;
  reviewedAt: string | null;
  trialTitle: string;
};

type QueueResponse = {
  caveat: string;
  proposeMinConfidence: number;
  strongConfidence: number;
  unlinkedTrials: number;
  proposals: Proposal[];
  recent: Reviewed[];
};

type Notice = { tone: 'info' | 'warn' | 'error'; text: string };

// Tailwind's JIT only sees complete class strings, so every variant is spelled
// out. Green is not in here on purpose: on this platform green means
// "recruiting", never "this button is the agreeable one".
const NOTICE_STYLE: Record<Notice['tone'], string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
};

const CONFIDENCE_STYLE: Record<'strong' | 'moderate', string> = {
  strong: 'bg-blue-50 text-blue-700 ring-blue-200',
  moderate: 'bg-amber-50 text-amber-700 ring-amber-200',
};

export function MatchesClient() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanLimit, setScanLimit] = useState(8);
  // Most trials yield nothing, so a scan has to move forward through the
  // backlog instead of re-searching the same first page. Wraps to the start
  // once a run comes back short — that is the end of the list.
  const [cursor, setCursor] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/nct-match', { cache: 'no-store' });
      if (res.status === 404) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) {
        setNotice({ tone: 'error', text: `Could not load the queue (HTTP ${res.status}).` });
        return;
      }
      setQueue((await res.json()) as QueueResponse);
      setUnavailable(false);
    } catch {
      setNotice({ tone: 'error', text: 'Could not reach the server. Check your connection and reload.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/nct-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: scanLimit, skip: cursor }),
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setNotice({ tone: 'error', text: readString(json, 'error') ?? `Scan failed (HTTP ${res.status}).` });
        return;
      }
      const created = readNumber(json, 'created');
      const scanned = readNumber(json, 'scanned');
      const silent = readNumber(json, 'withoutProposal');
      const wrapped = scanned < scanLimit;
      setCursor(wrapped ? 0 : cursor + scanned);
      setNotice({
        tone: created > 0 ? 'info' : 'warn',
        text:
          `Searched ${scanned} unlinked ${scanned === 1 ? 'trial' : 'trials'} (starting at #${cursor + 1}): ` +
          `${created} new ${created === 1 ? 'proposal' : 'proposals'}, ${silent} with nothing confident enough to propose. ` +
          (wrapped ? 'That was the end of the list — the next search starts again from the beginning.' : 'Search again to continue through the list.'),
      });
      await load();
    } catch {
      setNotice({ tone: 'error', text: 'The scan could not reach the server.' });
    } finally {
      setScanning(false);
    }
  };

  const decide = async (candidateId: string, decision: 'confirm' | 'reject') => {
    setBusyId(candidateId);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/nct-match', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, decision }),
      });
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        setNotice({ tone: 'error', text: readString(json, 'error') ?? `That did not go through (HTTP ${res.status}).` });
        return;
      }
      setNotice({ tone: 'info', text: readString(json, 'message') ?? 'Recorded.' });
      setConfirmingId(null);
      await load();
    } catch {
      setNotice({ tone: 'error', text: 'Could not reach the server; nothing was changed.' });
    } finally {
      setBusyId(null);
    }
  };

  // Hoisted out of the card loop so the threshold is read once, not narrowed
  // through a closure. The fallback never applies — proposals only exist once
  // the queue has loaded — it just keeps the type honest.
  const strongAt = queue?.strongConfidence ?? 80;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] text-slate-800 sm:px-6 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
      {/* inline-flex + min-h-11 = 44px tap target on touch screens; plain inline on desktop. */}
      <a href="/admin" className="inline-flex min-h-11 items-center text-sm text-blue-600 hover:underline lg:inline lg:min-h-0">
        ← Back to tree
      </a>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">ClinicalTrials.gov matches</h1>
      <p className="mt-1 text-slate-500">
        Proposed links between TrialTree trials that have no NCT number and records on ClinicalTrials.gov.
        Nothing here is applied until you confirm it.
      </p>

      {unavailable ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h2 className="text-base font-bold">Matching is switched off on this deployment</h2>
          <p className="mt-2 text-sm">
            The endpoint returns 404 unless admin tooling is enabled for the instance. Enable it, or run this
            screen locally, before reviewing matches.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            {queue?.caveat ??
              'These are search results, not answers. Open the record and read it before you confirm.'}
          </p>

          <section aria-labelledby="scan-heading" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 id="scan-heading" className="text-base font-bold text-slate-900">
              Search for new proposals
            </h2>
            <p id="scan-explainer" className="mt-1 text-sm text-slate-500">
              {queue
                ? `${queue.unlinkedTrials} ${queue.unlinkedTrials === 1 ? 'trial has' : 'trials have'} no NCT number. ` +
                  `A proposal is only recorded at ${queue.proposeMinConfidence} confidence or above — a weak search records nothing.`
                : 'Counting trials without an NCT number…'}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1">
                <label htmlFor="scan-limit" className="text-sm font-medium text-slate-700">
                  Trials to search
                </label>
                <input
                  id="scan-limit"
                  type="number"
                  min={1}
                  max={25}
                  inputMode="numeric"
                  value={scanLimit}
                  onChange={(e) => setScanLimit(clampLimit(e.target.value))}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:w-28"
                />
              </div>
              <button
                type="button"
                onClick={scan}
                disabled={scanning}
                aria-describedby="scan-explainer"
                className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {scanning ? 'Searching ClinicalTrials.gov…' : 'Search ClinicalTrials.gov'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Next search starts at unlinked trial #{cursor + 1}. Each trial costs up to three requests to a public
              API, so this runs in series and can take a minute.
            </p>
          </section>

          {/* Announced to screen readers, since a decision changes a card that may scroll away. */}
          <div aria-live="polite" role="status">
            {notice && (
              <p className={`mt-4 break-words rounded-xl border p-4 text-sm ${NOTICE_STYLE[notice.tone]}`}>{notice.text}</p>
            )}
          </div>

          <h2 className="mt-10 text-lg font-bold text-slate-700">
            Awaiting verification{queue ? ` (${queue.proposals.length})` : ''}
          </h2>

          <section className="mt-3 space-y-5">
            {loading && !queue && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">Loading…</div>
            )}
            {queue && queue.proposals.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
                Nothing waiting. An empty queue can mean every trial is linked — or that the search found nothing it
                was confident enough to propose, which is the expected result for most trials.
              </div>
            )}

            {queue?.proposals.map((p) => {
              const tier: 'strong' | 'moderate' = p.confidence >= strongAt ? 'strong' : 'moderate';
              const headingId = `proposal-${p.id}`;
              return (
                <article
                  key={p.id}
                  aria-labelledby={headingId}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={headingId} className="break-words text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Proposed link · {p.nctId}
                    </h3>
                    {/* Word + number, never colour alone. */}
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${CONFIDENCE_STYLE[tier]}`}>
                      {p.confidence}/100 · {tier === 'strong' ? 'strong signal' : 'moderate signal'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">TrialTree trial</h4>
                      <p className="mt-2 break-words font-semibold text-slate-900">{p.trial.title}</p>
                      <dl className="mt-3 space-y-1 break-words text-sm text-slate-600">
                        <Field label="Protocol number" value={p.trial.protocolNumber} />
                        <Field label="Shorthand" value={p.trial.shorthand} />
                        <Field label="Phase" value={p.trial.phase} />
                        <Field label="Principal investigator" value={p.trial.principalInvestigator} />
                        <Field label="Centers" value={p.trial.centers.length > 0 ? p.trial.centers.join(', ') : null} />
                      </dl>
                      {/* A proposal outlives the trial it was made for. If the trial picked up an
                          NCT number since, say so here rather than letting Confirm fail. */}
                      {p.trial.nctId && (
                        <p className="mt-3 break-words rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                          This trial already carries {p.trial.nctId}. Confirming this proposal will be refused.
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">ClinicalTrials.gov record</h4>
                      <p className="mt-2 break-words font-semibold text-slate-900">{p.candidateTitle}</p>
                      <a
                        href={p.ctgovUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${p.nctId} on ClinicalTrials.gov in a new tab`}
                        className="mt-3 inline-flex min-h-11 items-center break-all text-sm font-semibold text-blue-600 hover:underline"
                      >
                        Open {p.nctId} on ClinicalTrials.gov ↗
                      </a>
                      <p className="text-xs text-slate-500">Read the record before deciding. Opens in a new tab.</p>
                    </div>
                  </div>

                  <h4 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Why this was proposed</h4>
                  <ul className="mt-2 list-disc space-y-1 break-words pl-5 text-sm text-slate-700">
                    {p.evidenceLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>

                  {p.points.length > 0 && (
                    <details className="mt-3 text-sm">
                      <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-slate-600">
                        How the {p.confidence} was calculated
                      </summary>
                      <ul className="mt-2 space-y-1 pl-1 text-slate-600">
                        {p.points.map((pt, i) => (
                          <li key={i} className="flex justify-between gap-3 break-words">
                            <span>{pt.label}</span>
                            <span className="shrink-0 font-mono">{pt.value > 0 ? `+${pt.value}` : pt.value}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {confirmingId === p.id ? (
                    <div
                      role="group"
                      aria-label={`Confirm linking ${p.nctId}`}
                      className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4"
                    >
                      <p className="break-words text-sm font-medium text-blue-900">
                        Write {p.nctId} onto “{p.trial.title}”? This is what patients and clinicians will see.
                      </p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          autoFocus
                          disabled={busyId === p.id}
                          onClick={() => decide(p.id, 'confirm')}
                          className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {busyId === p.id ? 'Linking…' : `Yes, link ${p.nctId}`}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => setConfirmingId(null)}
                          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => setConfirmingId(p.id)}
                        className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Confirm this match
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => decide(p.id, 'reject')}
                        className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {busyId === p.id ? 'Working…' : 'Reject'}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          {queue && queue.recent.length > 0 && (
            <>
              <h2 className="mt-12 text-lg font-bold text-slate-700">Recently reviewed</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {queue.recent.map((r) => (
                  <li key={r.id} className="break-words rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
                    <span className="font-semibold text-slate-700">
                      {r.status === 'CONFIRMED' ? 'Linked' : 'Rejected'}
                    </span>{' '}
                    · {r.nctId} · <span className="text-slate-500">{r.trialTitle}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** A labelled fact, or a visible "not recorded" so a blank never reads as agreement. */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium text-slate-500">{label}:</dt>
      <dd className={value ? 'text-slate-800' : 'text-slate-500'}>{value ?? 'Not recorded'}</dd>
    </div>
  );
}

function clampLimit(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(25, n));
}

function readString(json: Record<string, unknown> | null, key: string): string | null {
  const v = json ? json[key] : null;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(json: Record<string, unknown> | null, key: string): number {
  const v = json ? json[key] : null;
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
