import { CURATED_TREES, type CuratedNode } from './curatedData';

// Facts about the curated catalog, counted from curatedData at render time.
//
// Anything the site says about coverage — how many trials, which centers — is
// derived here rather than typed into copy. A stale hand-written figure on a
// trial finder is a clinical problem, not a copy problem: listing a center as
// covered when none of its trials have been curated tells a patient to look for
// something that is not there.

export function countTrials(node: CuratedNode): number {
  let total = node.trials?.length ?? 0;
  for (const child of node.children ?? []) total += countTrials(child);
  return total;
}

function collectCenters(node: CuratedNode, found: Set<string>): void {
  for (const trial of node.trials ?? []) {
    for (const site of trial.sites) found.add(site.center);
  }
  for (const child of node.children ?? []) collectCenters(child, found);
}

/** Slugs of the centers that hold at least one curated trial. */
export function mappedCenterSlugs(): Set<string> {
  const found = new Set<string>();
  for (const root of CURATED_TREES) collectCenters(root, found);
  return found;
}
