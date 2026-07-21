'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TreeData, TreeFilter, TrialDTO, DecisionNodeDTO } from '@/types';
import { treatmentClass, CLASS_ORDER } from '@/lib/treatmentClass';
import { centerBySlug } from '@/lib/locations';

const DOT: Record<string, string> = {
  RECRUITING: 'bg-emerald-500',
  WAITLISTED: 'bg-amber-500',
  CLOSED: 'bg-slate-400',
  SUSPENDED: 'bg-rose-500',
};
const KIND_ACCENT: Record<string, string> = {
  DISEASE_TYPE: 'text-blue-700',
  DISEASE_STATE: 'text-violet-700',
  BIOMARKER: 'text-emerald-700',
  LINE_OF_THERAPY: 'text-amber-700',
};
const KIND_TAG: Record<string, string> = {
  DISEASE_TYPE: 'Cancer',
  DISEASE_STATE: 'State',
  BIOMARKER: 'Biomarker',
  LINE_OF_THERAPY: 'Line',
};

const isRecruiting = (t: TrialDTO) => t.locations.some((l) => l.status === 'RECRUITING');

function matchesFilter(t: TrialDTO, filter: TreeFilter): boolean {
  if (filter.locationSlug && !t.locations.some((l) => l.locationSlug === filter.locationSlug)) return false;
  if (filter.pi) {
    const hit = t.principalInvestigator === filter.pi || t.locations.some((l) => l.piName === filter.pi);
    if (!hit) return false;
  }
  const q = filter.search?.trim().toLowerCase();
  if (q) {
    const hay = [
      t.title,
      t.nctId,
      t.shorthand,
      t.protocolNumber,
      t.principalInvestigator,
      ...t.locations.map((l) => l.piName ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function OutlineBrowser({
  data,
  filter,
  onSelectTrial,
}: {
  data: TreeData;
  filter: TreeFilter;
  onSelectTrial: (t: TrialDTO) => void;
}) {
  const searching = !!filter.search?.trim();

  const { roots, childMap, directTrials, subtree } = useMemo(() => {
    const trials = data.trials.filter((t) => matchesFilter(t, filter));

    const childMap = new Map<string, DecisionNodeDTO[]>();
    for (const n of data.decisionNodes) {
      if (!n.parentId) continue;
      (childMap.get(n.parentId) ?? childMap.set(n.parentId, []).get(n.parentId)!).push(n);
    }
    const directTrials = new Map<string, TrialDTO[]>();
    for (const t of trials) {
      (directTrials.get(t.decisionNodeId) ?? directTrials.set(t.decisionNodeId, []).get(t.decisionNodeId)!).push(t);
    }
    const cache = new Map<string, TrialDTO[]>();
    const subtree = (id: string): TrialDTO[] => {
      const hit = cache.get(id);
      if (hit) return hit;
      const all = [...(directTrials.get(id) ?? []), ...(childMap.get(id) ?? []).flatMap((c) => subtree(c.id))];
      cache.set(id, all);
      return all;
    };
    let roots = data.decisionNodes.filter((n) => !n.parentId);
    if (filter.diseaseLabel) roots = roots.filter((n) => n.label === filter.diseaseLabel);
    return { roots, childMap, directTrials, subtree };
  }, [data, filter]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Open the disease level on first load so states are visible right away.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || roots.length === 0) return;
    seeded.current = true;
    setExpanded(new Set(roots.map((r) => r.id)));
  }, [roots]);

  const toggle = (id: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const open = (id: string) => searching || expanded.has(id);

  const renderTrials = (nodeId: string, depth: number): ReactNode => {
    const own = directTrials.get(nodeId) ?? [];
    if (!own.length) return null;
    const byClass = new Map<string, TrialDTO[]>();
    for (const t of own) {
      const c = treatmentClass(t);
      (byClass.get(c) ?? byClass.set(c, []).get(c)!).push(t);
    }
    return CLASS_ORDER.filter((c) => byClass.has(c)).map((c) => {
      const ts = byClass.get(c)!;
      const gid = `grp:${nodeId}:${c}`;
      return (
        <div key={gid}>
          <Row
            depth={depth}
            open={open(gid)}
            onClick={() => toggle(gid)}
            tag="Approach"
            accent="text-amber-300"
            label={c}
            count={ts.length}
            rec={ts.filter(isRecruiting).length}
          />
          {open(gid) && ts.map((t) => <TrialRow key={t.id} depth={depth + 1} trial={t} onClick={() => onSelectTrial(t)} />)}
        </div>
      );
    });
  };

  const renderNode = (node: DecisionNodeDTO, depth: number): ReactNode => {
    const st = subtree(node.id);
    if (!st.length) return null;
    const kids = (childMap.get(node.id) ?? []).filter((c) => subtree(c.id).length);
    return (
      <div key={node.id}>
        <Row
          depth={depth}
          open={open(node.id)}
          onClick={() => toggle(node.id)}
          tag={KIND_TAG[node.kind] ?? ''}
          accent={KIND_ACCENT[node.kind] ?? 'text-slate-300'}
          label={node.label}
          count={st.length}
          rec={st.filter(isRecruiting).length}
        />
        {open(node.id) && (
          <div>
            {kids.map((c) => renderNode(c, depth + 1))}
            {renderTrials(node.id, depth + 1)}
          </div>
        )}
      </div>
    );
  };

  const empty = roots.every((r) => subtree(r.id).length === 0);

  return (
    <div className="h-full overflow-y-auto px-4 py-5">
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {empty ? (
          <div className="py-20 text-center text-slate-400">No trials match your filters.</div>
        ) : (
          roots.map((r) => renderNode(r, 0))
        )}
      </div>
    </div>
  );
}

function Row({
  depth,
  open,
  onClick,
  tag,
  accent,
  label,
  count,
  rec,
}: {
  depth: number;
  open: boolean;
  onClick: () => void;
  tag: string;
  accent: string;
  label: string;
  count: number;
  rec: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left hover:bg-slate-100"
      style={{ paddingLeft: 10 + depth * 20 }}
    >
      <span className={`inline-block w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>
        ▸
      </span>
      <span className={`text-[0.58rem] font-bold uppercase tracking-wider ${accent}`}>{tag}</span>
      <span className="truncate font-semibold text-slate-800">{label}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ring-1 ring-slate-200">{count}</span>
        {rec > 0 && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
            {rec} recruiting
          </span>
        )}
      </span>
    </button>
  );
}

function TrialRow({ depth, trial, onClick }: { depth: number; trial: TrialDTO; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-2 rounded-lg py-1.5 pr-3 text-left hover:bg-slate-100"
      style={{ paddingLeft: 10 + depth * 20 }}
    >
      <span className="mt-1 w-3 shrink-0 text-slate-300">•</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[0.58rem] font-bold uppercase text-blue-600">{trial.phase ?? 'Trial'}</span>
          {trial.nctId && <span className="text-[0.58rem] text-slate-400">{trial.nctId}</span>}
        </span>
        <span className="block text-sm leading-snug text-slate-700">{trial.title}</span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.65rem] text-slate-500">
          {trial.locations.map((l) => (
            <span key={l.locationSlug} className="inline-flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${DOT[l.status] ?? 'bg-slate-400'}`} />
              {centerBySlug(l.locationSlug)?.shortName ?? l.locationName}
            </span>
          ))}
        </span>
      </span>
      <span className="mt-1 shrink-0 text-slate-300 group-hover:text-slate-600">→</span>
    </button>
  );
}
