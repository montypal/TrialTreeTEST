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
  const [view, setView] = useState<'outline' | 'map'>('map');
  const [entered, setEntered] = useState(false);
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

  // Breadcrumb for the stepped map — reflects the selected cancer + drill path.
  const crumbs = useMemo(() => {
    const arr: { id: string | null; label: string }[] = [{ id: null, label: 'Cancer types' }];
    if (!data) return arr;
    const nodeById = new Map(data.decisionNodes.map((n) => [n.id, n] as const));
    const diseaseNodeId = filter.diseaseLabel
      ? (data.decisionNodes.find((n) => !n.parentId && n.label === filter.diseaseLabel)?.id ?? null)
      : null;
    const eff = focusId ?? diseaseNodeId;
    if (!eff) return arr;
    const pushPath = (startId: string) => {
      const chain: { id: string; label: string }[] = [];
      let cur = nodeById.get(startId);
      let g = 0;
      while (cur && g++ < 12) {
        chain.unshift({ id: cur.id, label: cur.label });
        cur = cur.parentId ? nodeById.get(cur.parentId) : undefined;
      }
      for (const c of chain) arr.push(c);
    };
    if (eff.startsWith('grp:')) {
      const parts = eff.split(':');
      pushPath(parts[1]);
      arr.push({ id: eff, label: parts.slice(2).join(':') });
    } else {
      pushPath(eff);
    }
    return arr;
  }, [data, focusId, filter.diseaseLabel]);

  const onNodeClick = useCallback(
    (_e: MouseEvent, node: Node) => {
      if (node.type === 'trial') {
        const id = node.id.replace(/^trial-/, '');
        setSelected(data?.trials.find((t) => t.id === id) ?? null);
      } else if (node.type === 'decision') {
        setFocusId(node.id); // drill one level (real node or grp: approach)
        setSelected(null);
      }
    },
    [data],
  );

  const chooseCancer = (label: string | null) => {
    setFilter((f) => ({ ...f, diseaseLabel: label }));
    setFocusId(null);
    setEntered(true);
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
            stepped
            focusNodeId={focusId}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)}
          />
        )}

        {/* Entry prompt: pick a cancer type to explore. */}
        {!loading && data && !entered && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
            <div className="text-3xl font-extrabold tracking-tight text-slate-50">Welcome to TrialTree</div>
            <p className="mt-2 text-slate-400">Which cancer would you like to explore?</p>
            <div className="mt-7 flex flex-wrap justify-center gap-4">
              {diseases.map((d) => (
                <button
                  key={d}
                  onClick={() => chooseCancer(d)}
                  className="min-w-[180px] rounded-2xl border border-blue-500/40 bg-blue-500/10 px-8 py-6 text-lg font-bold text-slate-100 transition hover:border-blue-400 hover:bg-blue-500/20"
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              onClick={() => chooseCancer(null)}
              className="mt-6 text-sm font-semibold text-slate-400 hover:text-slate-200"
            >
              Or view all GU cancers →
            </button>
          </div>
        )}

        {/* Top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900/90 text-xs font-semibold shadow-lg">
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 ${view === 'map' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ⊹ Map
              </button>
              <button
                onClick={() => setView('outline')}
                className={`px-3 py-1.5 ${view === 'outline' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                ☰ Outline
              </button>
            </div>

            {view === 'map' && (
              <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 text-xs shadow-lg">
                {crumbs.map((c, i) => (
                  <span key={`${c.id ?? 'root'}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-600">›</span>}
                    {i < crumbs.length - 1 ? (
                      <button
                        onClick={() => {
                          if (c.id === null) setFilter((f) => ({ ...f, diseaseLabel: null }));
                          setFocusId(c.id);
                        }}
                        className="font-semibold text-slate-400 hover:text-white"
                      >
                        {c.label}
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-100">{c.label}</span>
                    )}
                  </span>
                ))}
              </div>
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
