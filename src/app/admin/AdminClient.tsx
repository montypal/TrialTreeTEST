'use client';

import { useState } from 'react';
import { TreeFlow } from '@/components/TreeFlow';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { useTreeStream } from '@/components/useTreeStream';
import type { TreeFilter } from '@/types';

export function AdminClient() {
  const [filter, setFilter] = useState<TreeFilter>({ locationSlug: null, pi: null });
  // Admin watches the global stream so it reflects changes at any center.
  const { data, loading, connected, lastSummary } = useTreeStream({});

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
          <TreeFlow data={data} filter={filter} />
        )}
        {/* Local-only real-time simulator (removed from production builds). */}
        <DevTools />
      </main>
    </div>
  );
}
