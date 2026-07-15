'use client';

import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import { TreeFlow } from '@/components/TreeFlow';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { TrialDetail } from '@/components/TrialDetail';
import { useTreeStream } from '@/components/useTreeStream';
import type { TreeFilter, TrialDTO } from '@/types';

export function AdminClient() {
  const [filter, setFilter] = useState<TreeFilter>({ locationSlug: null, pi: null });
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TrialDTO | null>(null);
  // Admin watches the global stream so it reflects changes at any center.
  const { data, loading, connected, lastSummary } = useTreeStream({});

  const diseases = useMemo(
    () => (data?.decisionNodes ?? []).filter((n) => n.kind === 'DISEASE_TYPE').map((n) => n.label),
    [data],
  );

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.trials.length;
    const recruiting = data.trials.filter((t) =>
      t.locations.some((l) => l.status === 'RECRUITING'),
    ).length;
    const centers = new Set(data.trials.flatMap((t) => t.locations.map((l) => l.locationSlug))).size;
    return { total, recruiting, centers };
  }, [data]);

  const focusLabel = useMemo(
    () => data?.decisionNodes.find((n) => n.id === focusId)?.label ?? null,
    [data, focusId],
  );

  const onNodeClick = useCallback(
    (_e: MouseEvent, node: Node) => {
      if (node.type === 'trial') {
        const id = node.id.replace(/^trial-/, '');
        setSelected(data?.trials.find((t) => t.id === id) ?? null);
      } else if (node.type === 'decision' && !node.id.startsWith('phase:')) {
        setFocusId(node.id); // drill into this branch (ignore synthetic phase groups)
        setSelected(null);
      }
    },
    [data],
  );

  const resetView = () => {
    setFocusId(null);
    setSelected(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        pis={data?.principalInvestigators ?? []}
        diseases={diseases}
        filter={filter}
        connected={connected}
        lastSummary={lastSummary}
        onChange={(f) => {
          setFilter(f);
          setFocusId(null);
        }}
      />
      <main className="relative flex-1">
        {loading || !data ? (
          <div className="flex h-full items-center justify-center text-xl text-slate-500">
            Loading trial map…
          </div>
        ) : (
          <TreeFlow
            data={data}
            filter={filter}
            focusNodeId={focusId}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)}
          />
        )}

        {/* Top bar: stats + breadcrumb */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            {focusId ? (
              <button
                onClick={resetView}
                className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg hover:bg-slate-800"
              >
                ← All branches{focusLabel ? ` · ${focusLabel}` : ''}
              </button>
            ) : (
              <span className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 shadow-lg">
                Click a branch to drill in →
              </span>
            )}
          </div>

          {stats && (
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-1.5 text-xs shadow-lg">
              <span className="font-bold text-slate-100">{stats.total}</span>
              <span className="text-slate-400">trials</span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
                <span className="font-bold text-green-300">{stats.recruiting}</span>
                <span className="text-slate-400">recruiting</span>
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">{stats.centers} centers</span>
            </div>
          )}
        </div>

        {selected && <TrialDetail trial={selected} onClose={() => setSelected(null)} />}

        {/* Local-only real-time simulator (removed from production builds). */}
        <DevTools />
      </main>
    </div>
  );
}
