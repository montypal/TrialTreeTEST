import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enrichAll } from '@/lib/ctgov/enrich';
import { coerceEvidence, ctgovStudyUrl, describeEvidence } from '@/lib/ctgov/match';
import { publishTreeUpdate } from '@/lib/events';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Up to 90s of ClinicalTrials.gov work (a soft budget that can overshoot by
// one in-flight request).
export const maxDuration = 150;

// ---------------------------------------------------------------------------
// The NCT enrichment workflow, on demand. Guarded like the other dev
// endpoints: 404 unless ENABLE_DEV_SIMULATE=true on a deployed instance.
//
//   POST → run the job (match missing NCTs, then refresh registry facts)
//   GET  → read-only: the curator's verification list. Every trial still
//          without an NCT, with the PROPOSED candidates to check, plus the
//          trials the job linked on its own so those can be checked too.
//
// The fix for a verified proposal is to add the NCT to curatedData.ts and
// reload, so the curated file stays the source of truth.
// ---------------------------------------------------------------------------

export async function POST() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  try {
    const result = await enrichAll(prisma);
    if (result.matched.length > 0 || result.refreshed > 0) {
      publishTreeUpdate({
        location: 'all',
        action: 'ENRICH',
        summary: `Linked ${result.matched.length} NCT numbers; refreshed registry facts for ${result.refreshed} trials`,
      });
    }
    return NextResponse.json({ status: 'ENRICHED', ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { status: 'ERROR', error: e instanceof Error ? e.message : 'enrichment failed' },
      { status: 500 },
    );
  }
}

export async function GET() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  try {
    const [pending, autoMatched] = await Promise.all([
      prisma.trial.findMany({
        where: { nctId: null },
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          protocolNumber: true,
          phase: true,
          locations: { select: { location: { select: { name: true } } } },
          nctMatchCandidates: {
            where: { status: 'PROPOSED' },
            orderBy: [{ confidence: 'desc' }, { nctId: 'asc' }],
            select: { nctId: true, candidateTitle: true, confidence: true, evidence: true },
          },
        },
      }),
      prisma.trial.findMany({
        where: { nctSource: 'AUTO_MATCHED' },
        orderBy: { title: 'asc' },
        select: { id: true, title: true, protocolNumber: true, nctId: true, nctMatchNote: true },
      }),
    ]);

    return NextResponse.json(
      {
        howToResolve:
          'Open each record and read it before trusting it. To accept a proposal (or keep an ' +
          'automatic match), add its NCT to src/lib/tree/curatedData.ts and reload; to rule a record out, add it to ' +
          "that trial's rejectNct list. Reading this list changes nothing.",
        pendingVerification: pending.length,
        trials: pending.map((t) => ({
          id: t.id,
          title: t.title,
          protocolNumber: t.protocolNumber,
          phase: t.phase,
          centers: t.locations.map((l) => l.location.name),
          candidates: t.nctMatchCandidates.map((c) => ({
            nctId: c.nctId,
            candidateTitle: c.candidateTitle,
            confidence: c.confidence,
            ctgovUrl: ctgovStudyUrl(c.nctId),
            evidence: evidenceLines(c.evidence),
          })),
        })),
        autoMatched: autoMatched.map((t) => ({
          id: t.id,
          title: t.title,
          protocolNumber: t.protocolNumber,
          nctId: t.nctId,
          note: t.nctMatchNote,
          ctgovUrl: t.nctId ? ctgovStudyUrl(t.nctId) : null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not load the verification list' },
      { status: 500 },
    );
  }
}

/**
 * Stored evidence is untyped JSON. A row whose reasoning will not parse still
 * appears (hiding it would drop a trial out of review) but says so plainly.
 */
function evidenceLines(raw: unknown): string[] {
  const evidence = coerceEvidence(raw);
  if (!evidence) {
    return ['The stored reasoning for this proposal could not be read. Verify this one from scratch.'];
  }
  return describeEvidence(evidence);
}
