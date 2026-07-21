'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrialDetail } from '@/components/TrialDetail';
import type { TrialDTO } from '@/types';

type Match = {
  fit: 'strong' | 'possible' | 'weak';
  rationale: string;
  considerations: string;
  path: string;
  trial: TrialDTO;
};
type Response = { summary: string; matches: Match[] };

const EXAMPLES = [
  '68-year-old man with metastatic castration-resistant prostate cancer, BRCA2 mutation, progressed on abiraterone and docetaxel, ECOG 1.',
  'Woman with muscle-invasive bladder cancer, cisplatin-ineligible, being considered for neoadjuvant therapy before cystectomy.',
  'Metastatic clear-cell RCC, treatment-naive, intermediate IMDC risk, good organ function.',
];

const FIT_STYLE: Record<Match['fit'], string> = {
  strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  possible: 'bg-amber-50 text-amber-700 border-amber-200',
  weak: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function FindClient() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Response | null>(null);
  const [selected, setSelected] = useState<TrialDTO | null>(null);

  const search = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong.');
      setResult(json as Response);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative mx-auto max-w-3xl px-6 py-10 text-slate-800">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Find a trial</h1>
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          Full tree →
        </Link>
      </div>
      <p className="mt-2 text-slate-600">
        Describe the clinical situation in plain language and the assistant will surface potential GU
        oncology trials across City of Hope, UCLA, UCSD, UCI, and USC — ranked, with the reasoning.
      </p>

      {/* PHI / safety notice */}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <strong>Do not enter identifiers.</strong> No names, dates of birth, MRNs, or addresses —
        describe the clinical scenario only (age range, disease, prior therapy, biomarkers, ECOG).
        This is decision support, not medical advice or an eligibility determination.
      </div>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') search();
        }}
        rows={5}
        placeholder="e.g. 72-year-old with mCRPC, HRR/BRCA2-mutated, progressed on ARPI, ECOG 0–1…"
        className="mt-4 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching the catalog…' : 'Find matching trials'}
        </button>
        <span className="text-xs text-slate-400">⌘/Ctrl + Enter</span>
      </div>

      {/* Example chips */}
      {!result && !loading && (
        <div className="mt-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Try an example</div>
          <div className="mt-2 space-y-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuery(ex)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 flex items-center gap-3 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
          Reading the scenario against every recruiting trial…
        </div>
      )}

      {result && (
        <section className="mt-8">
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {result.summary}
          </p>

          <div className="mt-4 space-y-3">
            {result.matches.map((m) => {
              const recruiting = m.trial.locations.filter((l) => l.status === 'RECRUITING');
              return (
                <article key={m.trial.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-bold uppercase ${FIT_STYLE[m.fit]}`}>
                      {m.fit} match
                    </span>
                    <span className="text-xs text-slate-400">{m.trial.phase ?? 'Phase N/A'}</span>
                    {m.trial.nctId && <span className="text-xs text-slate-400">· {m.trial.nctId}</span>}
                  </div>

                  <h3 className="mt-1.5 font-bold leading-snug text-slate-900">{m.trial.title}</h3>
                  <div className="text-xs text-slate-400">{m.path}</div>

                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Why: </span>
                    {m.rationale}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Verify: </span>
                    {m.considerations}
                  </p>

                  {recruiting.length > 0 && (
                    <div className="mt-2 text-xs font-medium text-emerald-700">
                      Recruiting at: {recruiting.map((l) => l.locationName).join(', ')}
                    </div>
                  )}

                  <button
                    onClick={() => setSelected(m.trial)}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Full details →
                  </button>
                </article>
              );
            })}
            {result.matches.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No clear matches in the current catalog. Try adding detail (biomarkers, prior lines),
                or browse the <Link href="/admin" className="text-blue-600 hover:underline">full tree</Link>.
              </div>
            )}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-slate-400">
        Matches are AI-generated decision support and may be incomplete or wrong. Confirm eligibility
        against the full protocol and the study team before acting.
      </p>

      {selected && <TrialDetail trial={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
