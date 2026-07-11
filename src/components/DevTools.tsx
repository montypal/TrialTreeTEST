'use client';

import { useState } from 'react';
import { CENTERS } from '@/lib/locations';

// Floating dev-only panel for firing /api/dev/simulate while you watch a kiosk
// on another monitor. Compiled out of production builds (NODE_ENV check below),
// so it never ships to a real screen.

type Mode = 'full' | 'flash';

const PRESETS: { label: string; text: string; location: string; mode: Mode }[] = [
  {
    label: 'Close bladder @ COH',
    text: 'Close the bladder trial at City of Hope, we hit accrual',
    location: 'city-of-hope',
    mode: 'full',
  },
  {
    label: 'Reopen bladder @ COH',
    text: 'Reopen the Phase II bladder trial at City of Hope',
    location: 'city-of-hope',
    mode: 'full',
  },
  {
    label: 'Add cohort @ UCLA',
    text: 'Add an HRR-mutated cohort to the prostate study at UCLA',
    location: 'ucla',
    mode: 'full',
  },
];

export function DevTools() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(PRESETS[0].text);
  const [location, setLocation] = useState('city-of-hope');
  const [mode, setMode] = useState<Mode>('full');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Never render in production builds.
  if (process.env.NODE_ENV === 'production') return null;

  const fire = async (override?: Partial<{ text: string; location: string; mode: Mode }>) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/dev/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: override?.text ?? text,
          location: override?.location ?? location,
          mode: override?.mode ?? mode,
        }),
      });
      const json = await res.json();
      setResult(`${json.status ?? json.mode}: ${json.message ?? ''}`.trim());
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'request failed');
    } finally {
      setBusy(false);
    }
  };

  const runEndpoint = async (path: string, label: string) => {
    setBusy(true);
    setResult(`${label}…`);
    try {
      const res = await fetch(path, { method: 'POST' });
      const json = await res.json();
      const detail =
        json.status === 'IMPORTED'
          ? `${json.created} new, ${json.updated} updated, ${json.siteRowsPreserved} edits kept`
          : (json.message ?? JSON.stringify(json));
      setResult(`${label}: ${detail}`.slice(0, 220));
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'request failed');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 top-4 z-50 rounded-full border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-lg hover:bg-slate-800"
        title="Dev simulator (local only)"
      >
        🛠 Dev
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-50 w-80 rounded-xl border border-slate-600 bg-slate-950/95 p-4 text-sm shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-200">🛠 Real-time simulator</span>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
          ✕
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Fires <code>/api/dev/simulate</code>. Watch a <code>/kiosk/&lt;location&gt;</code> tab redraw.
      </p>

      <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Data</div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <button
          disabled={busy}
          onClick={() => runEndpoint('/api/dev/import', 'Import')}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Import CT.gov trials
        </button>
        <button
          disabled={busy}
          onClick={() => runEndpoint('/api/dev/seed', 'Seed')}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
        >
          Load demo seed
        </button>
      </div>

      <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Simulate a text
      </div>
      <div className="mt-1 space-y-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            disabled={busy}
            onClick={() => {
              setText(p.text);
              setLocation(p.location);
              setMode(p.mode);
              fire(p);
            }}
            className="block w-full rounded-lg bg-blue-600 px-3 py-1.5 text-left text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Custom message
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
        />
        <div className="mt-2 flex gap-2">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          >
            {CENTERS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            title="full = run the AI parser + DB write; flash = just fire the SSE event"
          >
            <option value="full">full pipeline</option>
            <option value="flash">flash only</option>
          </select>
        </div>
        <button
          disabled={busy}
          onClick={() => fire()}
          className="mt-2 w-full rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
          {busy ? 'Firing…' : 'Simulate →'}
        </button>
      </div>

      {result && (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-xs text-slate-300">
          {result}
        </div>
      )}
    </div>
  );
}
