import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { TreeData } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/tree?location=<slug>&pi=<name>
 * Returns the full serialized tree. Filtering by location/PI is done client-side
 * in buildTree() so the kiosk can keep the whole dataset warm for instant redraws,
 * but we still accept the params for smaller payloads if a caller wants them.
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

  const piSet = new Set<string>();

  const data: TreeData = {
    decisionNodes: decisionNodes.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      parentId: n.parentId,
      sortOrder: n.sortOrder,
    })),
    trials: trials.map((t) => {
      if (t.principalInvestigator) piSet.add(t.principalInvestigator);
      return {
        id: t.id,
        nctId: t.nctId,
        protocolNumber: t.protocolNumber,
        shorthand: t.shorthand,
        title: t.title,
        phase: t.phase,
        principalInvestigator: t.principalInvestigator,
        decisionNodeId: t.decisionNodeId,
        locations: t.locations.map((l) => {
          if (l.piName) piSet.add(l.piName);
          return {
            locationSlug: l.location.slug,
            locationName: l.location.name,
            status: l.status,
            piName: l.piName,
            slotsOpen: l.slotsOpen,
          };
        }),
        cohorts: t.cohorts.map((c) => ({ id: c.id, label: c.label, status: c.status })),
      };
    }),
    principalInvestigators: [...piSet].sort(),
  };

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
