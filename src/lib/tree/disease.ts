import type { DecisionNodeDTO } from '@/types';

// ---------------------------------------------------------------------------
// A trial's disease, in words, from where it sits in the curated tree.
//
// The tree IS the disease classification: a trial under Prostate Cancer ›
// Metastatic castration-resistant (mCRPC) is an mCRPC trial. So the label is
// read off the path rather than stored a second time, and it can never
// disagree with where the card actually appears.
// ---------------------------------------------------------------------------

/** How each cancer reads in a short label. Keyed by the curated root label. */
const ROOT_SHORT: Record<string, string> = {
  'Prostate Cancer': 'Prostate',
  'Bladder Cancer': 'Bladder',
  'Renal Cell Carcinoma': 'Kidney',
  'Other GU Trials': 'Other GU',
};

export type DiseaseLabel = {
  /** Every level, in full: "Prostate Cancer › Metastatic castration-resistant (mCRPC)". */
  full: string;
  /** Compact, for a card: "Prostate · mCRPC". */
  short: string;
};

/** "Metastatic castration-resistant (mCRPC)" → "mCRPC"; anything else unchanged. */
function shortLevel(label: string): string {
  const abbr = label.match(/\(([^()]{2,12})\)\s*$/);
  return abbr ? abbr[1] : label;
}

/**
 * The disease label for the decision node a trial hangs off. Returns null if
 * the node is not in the list (a stale id), rather than a partial path that
 * would look complete.
 */
export function diseaseLabelFor(nodeId: string, nodes: DecisionNodeDTO[]): DiseaseLabel | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  if (!current) return null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.label);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  const [root, ...rest] = path;
  return {
    full: path.join(' › '),
    short: [ROOT_SHORT[root] ?? root, ...rest.map(shortLevel)].join(' · '),
  };
}
