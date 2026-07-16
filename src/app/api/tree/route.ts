import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cleanPi, piKey } from '@/lib/pi';
import type { TreeData } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/tree
 * Returns the full serialized tree. Investigator names are normalized here
 * (credentials stripped, junk dropped, deduped) so the PI dropdown and the PI
 * filter operate on the same clean values.
 */
export async function GET(_req: NextRequest) {
  const [decisionNodes, trials] = await Promise.all([
    prisma.decisionNode.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
    prisma.trial.findMany({
      include: {
        locations: { include: { location: true } },
        cohorts: true,
      },
    }),
  ]);

  // Deduped, cleaned PI display names (key -> display).
  const piMap = new Map<string, string>();
  const addPi = (raw: string | null) => {
    const clean = cleanPi(raw);
    if (clean && !piMap.has(piKey(clean))) piMap.set(piKey(clean), clean);
    return clean;
  };

  const data: TreeData = {
    decisionNodes: decisionNodes.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      parentId: n.parentId,
      sortOrder: n.sortOrder,
    })),
    trials: trials.map((t) => ({
      id: t.id,
      nctId: t.nctId,
      protocolNumber: t.protocolNumber,
      shorthand: t.shorthand,
      title: t.title,
      phase: t.phase,
      // Clean the lead PI for display, but do NOT add it to the filter list —
      // the dropdown should only offer California SITE investigators.
      principalInvestigator: cleanPi(t.principalInvestigator),
      eligibilityCriteria: t.eligibilityCriteria,
      decisionNodeId: t.decisionNodeId,
      locations: t.locations.map((l) => ({
        locationSlug: l.location.slug,
        locationName: l.location.name,
        status: l.status,
        piName: addPi(l.piName),
        slotsOpen: l.slotsOpen,
      })),
      cohorts: t.cohorts.map((c) => ({ id: c.id, label: c.label, status: c.status })),
    })),
    principalInvestigators: [...piMap.values()].sort((a, b) => a.localeCompare(b)),
  };

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
