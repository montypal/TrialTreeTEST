import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { centerBySlug } from '@/lib/locations';
import { buildCatalog, matchTrials, type CatalogItem } from '@/lib/ai/assistant';
import type { TrialDTO } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_QUERY = 6000;
const cap = (s: string) => s[0] + s.slice(1).toLowerCase();

// POST /api/assistant  { query }
// Public, viewer-facing trial matcher. NOTE for production: add rate limiting +
// a BAA with Anthropic before accepting anything that could contain PHI.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { query?: string } | null;
  const query = (body?.query ?? '').trim();
  if (!query) return NextResponse.json({ error: 'Describe a clinical scenario first.' }, { status: 400 });
  if (query.length > MAX_QUERY) {
    return NextResponse.json({ error: 'That is too long — please summarize the scenario.' }, { status: 400 });
  }

  const [nodes, trials] = await Promise.all([
    prisma.decisionNode.findMany(),
    prisma.trial.findMany({
      include: { locations: { include: { location: true } }, cohorts: true },
    }),
  ]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const pathOf = (nodeId: string): string => {
    const parts: string[] = [];
    let cur = nodeMap.get(nodeId);
    let guard = 0;
    while (cur && guard++ < 10) {
      parts.unshift(cur.label);
      cur = cur.parentId ? nodeMap.get(cur.parentId) : undefined;
    }
    return parts.join(' › ');
  };

  // Build the compact catalog for the model, and a lookup for hydrating results.
  const byNct = new Map<string, (typeof trials)[number]>();
  const catalogItems: CatalogItem[] = [];
  for (const t of trials) {
    if (!t.nctId) continue;
    byNct.set(t.nctId, t);
    const sites = t.locations
      .map((l) => `${centerBySlug(l.location.slug)?.shortName ?? l.location.name}(${cap(l.status)})`)
      .join(', ');
    catalogItems.push({
      nctId: t.nctId,
      phase: t.phase,
      path: pathOf(t.decisionNodeId),
      title: t.title,
      sites,
      eligibility: t.eligibilityCriteria ? t.eligibilityCriteria.replace(/\s+/g, ' ').slice(0, 240) : null,
    });
  }

  if (catalogItems.length === 0) {
    return NextResponse.json({ error: 'No trials loaded yet — run the import first.' }, { status: 400 });
  }

  let result;
  try {
    result = await matchTrials(query, buildCatalog(catalogItems), catalogItems.length);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'The assistant failed.' },
      { status: 502 },
    );
  }

  // Hydrate each match with the full trial details for display (drop hallucinated ids).
  const matches = result.matches
    .map((m) => {
      const t = byNct.get(m.nct_id);
      if (!t) return null;
      const trial: TrialDTO = {
        id: t.id,
        nctId: t.nctId,
        protocolNumber: t.protocolNumber,
        shorthand: t.shorthand,
        title: t.title,
        phase: t.phase,
        principalInvestigator: t.principalInvestigator,
        eligibilityCriteria: t.eligibilityCriteria,
        decisionNodeId: t.decisionNodeId,
        locations: t.locations.map((l) => ({
          locationSlug: l.location.slug,
          locationName: l.location.name,
          status: l.status,
          piName: l.piName,
          slotsOpen: l.slotsOpen,
        })),
        cohorts: t.cohorts.map((c) => ({ id: c.id, label: c.label, status: c.status })),
      };
      return { fit: m.fit, rationale: m.rationale, considerations: m.considerations, path: pathOf(t.decisionNodeId), trial };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return NextResponse.json({ summary: result.summary, matches });
}
