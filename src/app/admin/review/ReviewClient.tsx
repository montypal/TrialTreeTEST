'use client';

import { useCallback, useEffect, useState } from 'react';

type ActionLog = {
  id: string;
  source: string;
  sender: string;
  rawText: string;
  action: string | null;
  locationGuess: string | null;
  confidence: number | null;
  reasoning: string | null;
  status: string;
  resultMessage: string | null;
  createdAt: string;
};

export function ReviewClient() {
  const [pending, setPending] = useState<ActionLog[]>([]);
  const [recent, setRecent] = useState<ActionLog[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/pending', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setPending(json.pending ?? []);
      setRecent(json.recent ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (logId: string, decision: 'approve' | 'reject') => {
    setBusy(logId);
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logId, decision }),
    });
    setBusy(null);
    load();
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 text-slate-800">
      <a href="/admin" className="text-sm text-blue-600 hover:underline">
        ← Back to tree
      </a>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Review queue</h1>
      <p className="mt-1 text-slate-500">
        Low-confidence or failed AI actions. Approving runs the change and pushes it live to kiosks.
      </p>

      <section className="mt-8 space-y-4">
        {pending.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
            Nothing waiting. 🎉
          </div>
        )}
        {pending.map((a) => (
          <article key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {a.action ?? 'UNKNOWN'} · {a.source}
              </span>
              <span
                className={`text-sm font-bold ${
                  a.status === 'FAILED' ? 'text-rose-600' : 'text-amber-600'
                }`}
              >
                {a.status === 'FAILED' ? 'Failed to apply' : `${a.confidence ?? 0}% confidence`}
              </span>
            </div>
            <blockquote className="mt-3 border-l-2 border-slate-300 pl-3 italic text-slate-700">
              “{a.rawText}”
            </blockquote>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-500">
              <div>From: {a.sender}</div>
              <div>Location: {a.locationGuess ?? '—'}</div>
              <div className="col-span-2">AI read: {a.reasoning ?? '—'}</div>
              {a.resultMessage && <div className="col-span-2 text-rose-600">{a.resultMessage}</div>}
            </dl>
            <div className="mt-4 flex gap-3">
              <button
                disabled={busy === a.id}
                onClick={() => decide(a.id, 'approve')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve & apply
              </button>
              <button
                disabled={busy === a.id}
                onClick={() => decide(a.id, 'reject')}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </section>

      <h2 className="mt-12 text-lg font-bold text-slate-700">Recently applied</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {recent.map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-emerald-600">✓</span> {a.resultMessage ?? a.action} —{' '}
            <span className="text-slate-400">{a.sender}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
