'use client';

import { useEffect, useMemo, useState } from 'react';
import { TreeFlow } from '@/components/TreeFlow';
import { QRCodeBlock } from '@/components/QRCodeBlock';
import { useTreeStream } from '@/components/useTreeStream';
import { locationLabel } from '@/lib/locations';
import { RIBBON_STRIPE } from '@/lib/cancerColors';

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
    // h-dvh tracks the real visible height on iPhone/iPad (browser bars
    // included). h-screen stays as the fallback for older TV/E-Ink browsers
    // without dvh support, which would otherwise drop the height entirely.
    <div
      className={`kiosk relative flex h-screen w-screen flex-col overflow-hidden bg-[#f6f7f9] text-slate-800 supports-[height:100dvh]:h-dvh ${eink ? 'eink' : ''} ${
        flash && !eink ? 'animate-flash' : ''
      }`}
    >
      {/* Brand stripe (hidden in E-Ink mode, which stays pure black & white) */}
      {!eink && <div className={`h-1.5 w-full shrink-0 ${RIBBON_STRIPE}`} />}
      {/* Header band — high contrast, readable from 5–10 ft. The outer padding
          keeps it clear of the notch / rounded corners (insets are 0 on TVs). */}
      <header className="border-b border-slate-200 bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4 lg:px-8 lg:py-5">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold uppercase tracking-[0.2em] text-blue-600 sm:text-sm sm:tracking-[0.3em]">
              GU Oncology Trials
            </div>
            {/* Single line + ellipsis on phones/tablets; desktop keeps today's wrapping. */}
            <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:overflow-visible lg:whitespace-normal lg:text-4xl">
              {locationLabel(locationSlug)}
            </h1>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-3xl font-black tabular-nums text-emerald-600 sm:text-4xl lg:text-5xl">
              {recruitingCount}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-sm sm:tracking-widest">
              Actively recruiting
            </div>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              {connected ? 'Live' : 'Reconnecting…'}
            </div>
          </div>
        </div>
      </header>

      {/* The tree */}
      <div className="relative flex-1">
        {loading || !data ? (
          <div className="flex h-full items-center justify-center text-2xl text-slate-400">
            Loading trial map…
          </div>
        ) : trialsHere === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="text-xl font-bold text-slate-500 sm:text-3xl">
              No GU oncology trials mapped here yet
            </div>
            <div className="text-base text-slate-400 sm:text-xl">
              Scan the code below to add this center&apos;s first trial.
            </div>
          </div>
        ) : (
          <TreeFlow data={data} filter={filter} kiosk />
        )}

        {/* Live-update toast: one line, capped to the screen width, ellipsis if long */}
        {flash && lastSummary && (
          <div className="absolute left-1/2 top-6 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-xl sm:px-6 sm:text-lg">
            ↻ {lastSummary}
          </div>
        )}

        {/* QR code, bottom corner (margins keep it clear of the home indicator / notch) */}
        <div className="absolute bottom-3 right-3 mb-[env(safe-area-inset-bottom)] mr-[env(safe-area-inset-right)] sm:bottom-6 sm:right-6">
          <QRCodeBlock locationSlug={locationSlug} />
        </div>
      </div>
    </div>
  );
}
