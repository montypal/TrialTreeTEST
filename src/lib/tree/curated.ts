import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Hand-authored decision trees (the clinician-defined format).
//
// These replace the auto-classified CT.gov structure for a given cancer type.
// The tree is authored explicitly here — axis by axis — instead of being
// inferred from trial text. `tag` is the axis label shown on the node
// (Stage / Histology / Line); it's stored in DecisionNode.notes.
//
// Trials are attached later (per the clinician's curated list), so the tree is
// built as an empty skeleton — the nodes exist, ready to receive trials.
// ---------------------------------------------------------------------------

type Kind = 'DISEASE_TYPE' | 'DISEASE_STATE' | 'BIOMARKER' | 'LINE_OF_THERAPY';

type CuratedNode = {
  label: string;
  kind: Kind;
  tag: string;
  children?: CuratedNode[];
};

// Kidney (Renal Cell Carcinoma), exactly as drawn on the whiteboard:
//   RCC → Stage → Histology → Line
//   Only "Clear cell" carries therapy lines; "Non-clear cell" is a leaf.
const RCC: CuratedNode = {
  label: 'Renal Cell Carcinoma',
  kind: 'DISEASE_TYPE',
  tag: 'Cancer',
  children: [
    {
      label: 'Non-metastatic',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      children: [
        {
          label: 'Clear cell',
          kind: 'BIOMARKER',
          tag: 'Histology',
          children: [
            { label: 'Neoadjuvant', kind: 'LINE_OF_THERAPY', tag: 'Line' },
            { label: 'Adjuvant', kind: 'LINE_OF_THERAPY', tag: 'Line' },
          ],
        },
        { label: 'Non-clear cell', kind: 'BIOMARKER', tag: 'Histology' },
      ],
    },
    {
      label: 'Metastatic',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      children: [
        {
          label: 'Clear cell',
          kind: 'BIOMARKER',
          tag: 'Histology',
          children: [
            { label: 'First line', kind: 'LINE_OF_THERAPY', tag: 'Line' },
            { label: '2nd & Beyond', kind: 'LINE_OF_THERAPY', tag: 'Line' },
          ],
        },
        { label: 'Non-clear cell', kind: 'BIOMARKER', tag: 'Histology' },
      ],
    },
  ],
};

/** All curated cancer types. Add prostate/bladder here as they're defined. */
export const CURATED_TREES: CuratedNode[] = [RCC];

async function createNode(
  prisma: PrismaClient,
  node: CuratedNode,
  parentId: string | null,
  sortOrder: number,
): Promise<void> {
  const created = await prisma.decisionNode.create({
    data: { label: node.label, kind: node.kind, parentId, notes: node.tag, sortOrder },
  });
  let i = 0;
  for (const child of node.children ?? []) {
    await createNode(prisma, child, created.id, i++);
  }
}

/**
 * Rebuild a curated cancer type: drop the existing root (auto-classified or a
 * prior curated build) and everything under it — nodes and trials cascade —
 * then recreate the hand-authored skeleton. Idempotent.
 */
export async function applyCuratedTree(prisma: PrismaClient, root: CuratedNode): Promise<void> {
  const existing = await prisma.decisionNode.findMany({
    where: { label: root.label, kind: 'DISEASE_TYPE', parentId: null },
    select: { id: true },
  });
  for (const e of existing) {
    // Self-relation + Trial relations are onDelete: Cascade, so this removes the
    // whole subtree (states, histologies, lines) and any attached trials.
    await prisma.decisionNode.delete({ where: { id: e.id } });
  }
  await createNode(prisma, root, null, 0);
}

/** Rebuild every curated tree (currently just RCC). */
export async function applyCuratedTrees(prisma: PrismaClient): Promise<string[]> {
  const built: string[] = [];
  for (const root of CURATED_TREES) {
    await applyCuratedTree(prisma, root);
    built.push(root.label);
  }
  return built;
}
