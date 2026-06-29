'use client';

import { useEffect, useMemo, useState } from 'react';
import { TreeFlow } from '@/components/TreeFlow';
import { QRCodeBlock } from '@/components/QRCodeBlock';
import { useTreeStream } from '@/components/useTreeStream';
import { locationLabel } from '@/lib/locations';

export function KioskClient({ locationSlug }: { locationSlug: string }) {
  const filter = useMemo(() => ({ locationSlug }), [locationSlug]);
  const { data, loading, updateTick, lastSummary, connected } = useTreeStream(filter);

  // Subtle flash whenever a live update lands.
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (updateTick === 0) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(t);
  }, [updateTick]);

  // E-Ink mode via ?display=eink (sets max-contrast, animation-free styling).
  const [eink, setEink] = useState(false);
  useEffect(() => {
    setEink(new URLSearchParams(window.location.search).get('display') === 'eink');
  }, []);

  const recruitingCount = useMemo(() => {
    if (!data) return 0;
    return data.trials.filter((t) =>
      t.locations.some((l) => l.locationSlug === locationSlug && l.status === 'RECRUITING'),
    ).length;
  }, [data, locationSlug]);

  // Any trial linked to this center (recruiting or not) — drives the empty state.
  const trialsHere = useMemo(() => {
    if (!data) return 0;
    return data.trials.filter((t) => t.locations.some((l) => l.locationSlug === locationSlug)).length;
  }, [data, locationSlug]);

  return (
    <div
      className={`kiosk relative flex h-screen w-screen flex-col overflow-hidden ${eink ? 'eink' : ''} ${
        flash && !eink ? 'animate-flash' : ''
      }`}
    >
      {/* Header band — high contrast, readable from 5–10 ft */}
      <header className="flex items-center justify-between border-b border-slate-700 px-8 py-5">
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.3em] text-blue-300">
            GU Oncology Trials
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">{locationLabel(locationSlug)}</h1>
        </div>
        <div className="text-right">
          <div className="text-5xl font-black tabular-nums text-green-400">{recruitingCount}</div>
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Actively recruiting
          </div>
          <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-500">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-slate-500'}`}
            />
            {connected ? 'Live' : 'Reconnecting…'}
          </div>
        </div>
      </header>

      {/* The tree */}
      <div className="relative flex-1">
        {loading || !data ? (
          <div className="flex h-full items-center justify-center text-2xl text-slate-500">
            Loading trial map…
          </div>
        ) : trialsHere === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="text-3xl font-bold text-slate-300">
              No GU oncology trials mapped here yet
            </div>
            <div className="text-xl text-slate-500">
              Scan the code below to add this center&apos;s first trial.
            </div>
          </div>
        ) : (
          <TreeFlow data={data} filter={filter} kiosk />
        )}

        {/* Live-update toast */}
        {flash && lastSummary && (
          <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-green-600 px-6 py-2 text-lg font-bold text-white shadow-2xl">
            ↻ {lastSummary}
          </div>
        )}

        {/* QR code, bottom corner */}
        <div className="absolute bottom-6 right-6">
          <QRCodeBlock locationSlug={locationSlug} />
        </div>
      </div>
    </div>
  );
}
