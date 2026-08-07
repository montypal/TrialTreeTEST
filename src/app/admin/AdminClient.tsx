'use client';

import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Node } from '@xyflow/react';
import { TreeFlow } from '@/components/TreeFlow';
import { OutlineBrowser } from '@/components/OutlineBrowser';
import { Sidebar } from '@/components/Sidebar';
import { DevTools } from '@/components/DevTools';
import { TrialDetail } from '@/components/TrialDetail';
import { DecisionTreeBackdrop } from '@/components/DecisionTreeBackdrop';
import { useTreeStream } from '@/components/useTreeStream';
import type { TreeFilter, TrialDTO } from '@/types';

// Signature look per cancer for the welcome picker — falls back to slate.
const CANCER_STYLE: Record<string, { grad: string; hover: string; badge: string; bar: string }> = {
  'Prostate Cancer': {
    grad: 'from-blue-50 to-white',
    hover: 'hover:border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
    bar: 'bg-blue-500',
  },
  'Bladder Cancer': {
    grad: 'from-amber-50 to-white',
    hover: 'hover:border-amber-300',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
  },
  'Renal Cell Carcinoma': {
    grad: 'from-emerald-50 to-white',
    hover: 'hover:border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
  },
};
const CANCER_FALLBACK = {
  grad: 'from-slate-50 to-white',
  hover: 'hover:border-slate-300',
  badge: 'bg-slate-100 text-slate-700',
  bar: 'bg-slate-400',
};

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

  // Per-cancer trial + recruiting counts, shown on the welcome cards.
  const diseaseStats = useMemo(() => {
    const m = new Map<string, { total: number; rec: number }>();
    if (!data) return m;
    const nodeById = new Map(data.decisionNodes.map((n) => [n.id, n] as const));
    const rootLabel = (nodeId: string): string | null => {
      let cur = nodeById.get(nodeId);
      let g = 0;
      while (cur && cur.parentId && g++ < 12) cur = nodeById.get(cur.parentId);
      return cur?.label ?? null;
    };
    for (const t of data.trials) {
      const label = rootLabel(t.decisionNodeId);
      if (!label) continue;
      const cur = m.get(label) ?? { total: 0, rec: 0 };
      cur.total += 1;
      if (t.locations.some((l) => l.status === 'RECRUITING')) cur.rec += 1;
      m.set(label, cur);
    }
    return m;
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#f6f7f9] text-slate-800">
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
          <div className="flex h-full items-center justify-center text-xl text-slate-400">
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
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#f6f7f9] p-6 text-center">
            <div className="aurora">
              <div className="aurora-3" />
            </div>
            <DecisionTreeBackdrop className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.55]" />
            <div className="relative z-10 animate-fade-up">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-blue-600">
                GU Oncology Trial Map
              </div>
              <div className="mt-2 font-display text-4xl font-extrabold tracking-tight text-gradient sm:text-5xl">
                Welcome to TrialTree
              </div>
              <p className="mt-3 text-slate-500">Which cancer would you like to explore?</p>

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                {diseases.map((d) => {
                  const s = CANCER_STYLE[d] ?? CANCER_FALLBACK;
                  const st = diseaseStats.get(d);
                  return (
                    <button
                      key={d}
                      onClick={() => chooseCancer(d)}
                      className={`group relative w-60 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${s.grad} p-6 text-left shadow-card transition-all duration-300 hover:-translate-y-1.5 ${s.hover} hover:shadow-lift`}
                    >
                      <span className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
                      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl font-display text-xl font-extrabold ${s.badge}`}>
                        {d[0]}
                      </span>
                      <div className="mt-3 font-display text-lg font-bold leading-tight text-slate-900">{d}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {st ? (
                          <>
                            <span className="font-semibold text-slate-700">{st.total}</span> trials
                            {st.rec > 0 && <span className="text-emerald-600"> · {st.rec} recruiting</span>}
                          </>
                        ) : (
                          'View trials'
                        )}
                      </div>
                      <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                        Explore
                        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => chooseCancer(null)}
                className="mt-7 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                Or view all GU cancers →
              </button>
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-semibold shadow-sm">
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 ${view === 'map' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                ⊹ Map
              </button>
              <button
                onClick={() => setView('outline')}
                className={`px-3 py-1.5 ${view === 'outline' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                ☰ Outline
              </button>
            </div>

            {view === 'map' && (
              <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                {crumbs.map((c, i) => (
                  <span key={`${c.id ?? 'root'}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-300">›</span>}
                    {i < crumbs.length - 1 ? (
                      <button
                        onClick={() => {
                          if (c.id === null) setFilter((f) => ({ ...f, diseaseLabel: null }));
                          setFocusId(c.id);
                        }}
                        className="font-semibold text-slate-500 hover:text-slate-900"
                      >
                        {c.label}
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-900">{c.label}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {stats && (
            <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs shadow-sm">
              <span className="font-bold text-slate-900">{stats.total}</span>
              <span className="text-slate-500">trials</span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-600">{stats.recruiting}</span>
                <span className="text-slate-500">recruiting</span>
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500">{stats.centers} centers</span>
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
