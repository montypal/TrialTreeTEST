'use client';

import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import { TreeFlow } from '@/components/TreeFlow';
import { OutlineBrowser } from '@/components/OutlineBrowser';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { TrialDetail } from '@/components/TrialDetail';
import { useTreeStream } from '@/components/useTreeStream';
import type { TreeFilter, TrialDTO } from '@/types';

export function AdminClient() {
  const [filter, setFilter] = useState<TreeFilter>({ locationSlug: null, pi: null });
  const [view, setView] = useState<'outline' | 'map'>('outline');
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
    const recruiting = data.trials.filter((t) => t.locations.some((l) => l.status === 'RECRUITING')).length;
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
      } else if (node.type === 'decision' && !node.id.startsWith('grp:')) {
        setFocusId(node.id);
        setSelected(null);
      }
    },
    [data],
  );

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
            Loading trials…
          </div>
        ) : view === 'outline' ? (
          <div className="h-full pt-16">
            <OutlineBrowser data={data} filter={filter} onSelectTrial={setSelected} />
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

        {/* Top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            {/* View toggle */}
            <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900/90 text-xs font-semibold shadow-lg">
              <button
                onClick={() => setView('outline')}
                className={`px-3 py-1.5 ${view === 'outline' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ☰ Outline
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 ${view === 'map' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ⊹ Map
              </button>
            </div>

            {view === 'map' &&
              (focusId ? (
                <button
                  onClick={() => setFocusId(null)}
                  className="rounded-lg border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg hover:bg-slate-800"
                >
                  ← All branches{focusLabel ? ` · ${focusLabel}` : ''}
                </button>
              ) : (
                <span className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400 shadow-lg">
                  Click a branch to drill in →
                </span>
              ))}
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
