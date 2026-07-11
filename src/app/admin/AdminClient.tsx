'use client';

import { useState } from 'react';
import { TreeFlow } from '@/components/TreeFlow';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { useTreeStream } from '@/components/useTreeStream';
import type { TreeFilter } from '@/types';

export function AdminClient() {
  const [filter, setFilter] = useState<TreeFilter>({ locationSlug: null, pi: null });
  const [showTrials, setShowTrials] = useState(false);
  // Admin watches the global stream so it reflects changes at any center.
  const { data, loading, connected, lastSummary } = useTreeStream({});

  // Always start on the compact counts overview; the toggle expands the actual
  // trial cards. Filtering to a hospital/PI just narrows what's counted/shown.
  const collapse = !showTrials;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        pis={data?.principalInvestigators ?? []}
        filter={filter}
        connected={connected}
        lastSummary={lastSummary}
        onChange={setFilter}
      />
      <main className="relative flex-1">
        {loading || !data ? (
          <div className="flex h-full items-center justify-center text-xl text-slate-500">
            Loading trial map…
          </div>
        ) : (
          <TreeFlow data={data} filter={filter} collapse={collapse} />
        )}

        {/* Overview / expand toggle. */}
        <button
          onClick={() => setShowTrials((v) => !v)}
          className="absolute left-4 top-4 z-10 rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg hover:bg-slate-800"
        >
          {showTrials ? '▲ Back to overview' : '▼ Show individual trials'}
        </button>

        {/* Local-only real-time simulator (removed from production builds). */}
        <DevTools />
      </main>
    </div>
  );
}
