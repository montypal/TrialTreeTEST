import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { devToolsEnabled } from '@/lib/devGuard';
import { publishTreeUpdate } from '@/lib/events';
import {
  coerceEvidence,
  ctgovStudyUrl,
  describeEvidence,
  proposeMatches,
  searchCandidates,
  MATCH_CAVEAT,
  PROPOSE_MIN_CONFIDENCE,
  STRONG_CONFIDENCE,
  type TrialForMatching,
} from '@/lib/ctgov/match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// A scan makes up to three CT.gov round trips per trial, in series to stay
// polite to a public API. Eight trials can comfortably exceed the default.
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Propose-and-verify linkage between TrialTree trials and ClinicalTrials.gov.
//
//   GET    → the review queue (PROPOSED candidates + recent decisions)
//   POST   → search CT.gov for trials with no nctId and record PROPOSED rows
//   PATCH  → a human confirms or rejects one candidate
//
// CONFIRM is the only path in the entire codebase that writes Trial.nctId from
// a match. POST cannot, by construction: it only ever inserts candidate rows.
//
// Guarded with devToolsEnabled() — the same 404-unless-enabled gate the other
// write-capable non-webhook endpoints use — because this route mutates trial
// identity and there is still no SSO in front of /admin. See README "Security
// hardening"; this needs real auth before it is exposed on a public instance.
// ---------------------------------------------------------------------------

/** A review queue longer than this is not going to be reviewed; page it rather than dump it. */
const REVIEW_QUEUE_LIMIT = 100;
const DEFAULT_SCAN_LIMIT = 8;
const MAX_SCAN_LIMIT = 25;

export async function GET() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });

  try {
    const [proposed, reviewed, unlinkedTrials] = await Promise.all([
      prisma.nctMatchCandidate.findMany({
        where: { status: 'PROPOSED' },
        orderBy: [{ confidence: 'desc' }, { createdAt: 'asc' }],
        take: REVIEW_QUEUE_LIMIT,
        include: { trial: { include: { locations: { include: { location: true } } } } },
      }),
      prisma.nctMatchCandidate.findMany({
        where: { status: { in: ['CONFIRMED', 'REJECTED'] } },
        orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        include: { trial: { select: { id: true, title: true } } },
      }),
      prisma.trial.count({ where: { nctId: null } }),
    ]);

    return NextResponse.json(
      {
        caveat: MATCH_CAVEAT,
        proposeMinConfidence: PROPOSE_MIN_CONFIDENCE,
        strongConfidence: STRONG_CONFIDENCE,
        unlinkedTrials,
        proposals: proposed.map((row) => ({
          id: row.id,
          nctId: row.nctId,
          candidateTitle: row.candidateTitle,
          confidence: row.confidence,
          createdAt: row.createdAt.toISOString(),
          ctgovUrl: ctgovStudyUrl(row.nctId),
          ...readEvidence(row.evidence),
          trial: {
            id: row.trial.id,
            title: row.trial.title,
            protocolNumber: row.trial.protocolNumber,
            shorthand: row.trial.shorthand,
            phase: row.trial.phase,
            principalInvestigator: row.trial.principalInvestigator,
            nctId: row.trial.nctId,
            centers: row.trial.locations.map((l) => l.location.name),
          },
        })),
        recent: reviewed.map((row) => ({
          id: row.id,
          nctId: row.nctId,
          status: row.status,
          confidence: row.confidence,
          reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
          trialTitle: row.trial.title,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json({ error: message(e, 'Could not load the match queue') }, { status: 500 });
  }
}

/**
 * POST { trialId?: string, limit?: number, skip?: number }
 *
 * Searches CT.gov for trials that have no nctId and records PROPOSED
 * candidates. Writes nothing to Trial. A trial that produces no proposal is a
 * normal outcome — the scoring floor exists precisely so that a weak search
 * stays silent — so it is counted, not reported as an error.
 *
 * `skip` exists because most trials will never yield a proposal: without a
 * cursor the caller would re-search the same first page forever and never
 * reach the rest of the backlog. The ordering is stable (oldest first) and the
 * list only shrinks as trials get linked, so a client-side cursor is enough.
 */
export async function POST(req: NextRequest) {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { trialId?: unknown; limit?: unknown; skip?: unknown }
    | null;
  const trialId = typeof body?.trialId === 'string' && body.trialId.trim() ? body.trialId.trim() : null;
  const requested = typeof body?.limit === 'number' && Number.isFinite(body.limit) ? Math.floor(body.limit) : DEFAULT_SCAN_LIMIT;
  const limit = Math.max(1, Math.min(MAX_SCAN_LIMIT, requested));
  const skip = typeof body?.skip === 'number' && Number.isFinite(body.skip) ? Math.max(0, Math.floor(body.skip)) : 0;

  try {
    const trials = await prisma.trial.findMany({
      where: trialId ? { id: trialId } : { nctId: null },
      orderBy: { createdAt: 'asc' },
      skip: trialId ? 0 : skip,
      take: trialId ? 1 : limit,
      include: { locations: { include: { location: true } } },
    });

    if (trialId && trials.length === 0) {
      return NextResponse.json({ error: 'No trial with that id' }, { status: 404 });
    }

    let created = 0;
    let updated = 0;
    let skippedAlreadyReviewed = 0;
    let withoutProposal = 0;
    let skippedAlreadyLinked = 0;
    const errors: string[] = [];

    for (const trial of trials) {
      // Belt and braces: the default query already excludes linked trials, but
      // an explicit trialId could point at one.
      if (trial.nctId) {
        skippedAlreadyLinked += 1;
        continue;
      }

      const input: TrialForMatching = {
        id: trial.id,
        title: trial.title,
        protocolNumber: trial.protocolNumber,
        shorthand: trial.shorthand,
        phase: trial.phase,
        principalInvestigator: trial.principalInvestigator,
        sitePiNames: trial.locations.map((l) => l.piName).filter((n): n is string => typeof n === 'string' && n.length > 0),
        centerSlugs: trial.locations.map((l) => l.location.slug),
      };

      const search = await searchCandidates(input);
      for (const err of search.errors) errors.push(`${trial.title.slice(0, 60)}: ${err}`);

      const proposals = proposeMatches(input, search.candidates);
      if (proposals.length === 0) {
        withoutProposal += 1;
        continue;
      }

      for (const proposal of proposals) {
        // Upsert would resurrect a candidate a human already rejected, which
        // would make the queue argue with its own reviewers. So: look first,
        // and leave anything already decided exactly as the human left it.
        const existing = await prisma.nctMatchCandidate.findUnique({
          where: { trialId_nctId: { trialId: trial.id, nctId: proposal.nctId } },
        });

        if (!existing) {
          await prisma.nctMatchCandidate.create({
            data: {
              trialId: trial.id,
              nctId: proposal.nctId,
              candidateTitle: proposal.title,
              confidence: proposal.confidence,
              evidence: proposal.evidence as unknown as Prisma.InputJsonValue,
              status: 'PROPOSED',
            },
          });
          created += 1;
          continue;
        }

        if (existing.status !== 'PROPOSED') {
          skippedAlreadyReviewed += 1;
          continue;
        }

        await prisma.nctMatchCandidate.update({
          where: { id: existing.id },
          data: {
            candidateTitle: proposal.title,
            confidence: proposal.confidence,
            evidence: proposal.evidence as unknown as Prisma.InputJsonValue,
          },
        });
        updated += 1;
      }
    }

    return NextResponse.json({
      status: 'SCANNED',
      scanned: trials.length,
      skip: trialId ? 0 : skip,
      created,
      updated,
      withoutProposal,
      skippedAlreadyReviewed,
      skippedAlreadyLinked,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: message(e, 'Scan failed') }, { status: 500 });
  }
}

/**
 * PATCH { candidateId: string, decision: "confirm" | "reject" }
 *
 * CONFIRM is the human verification step, and the only place Trial.nctId is
 * written from a proposal. Trial.nctId is @unique, so a confirm that collides
 * with another trial has to read as a clear conflict, not a 500 — that case is
 * exactly the one where the matcher got it wrong and the reviewer needs to know.
 */
export async function PATCH(req: NextRequest) {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });

  const body = (await req.json().catch(() => null)) as { candidateId?: unknown; decision?: unknown } | null;
  const candidateId = typeof body?.candidateId === 'string' ? body.candidateId : '';
  const decision = body?.decision;
  if (!candidateId || (decision !== 'confirm' && decision !== 'reject')) {
    return NextResponse.json({ error: 'candidateId and decision ("confirm" | "reject") are required' }, { status: 400 });
  }

  try {
    const candidate = await prisma.nctMatchCandidate.findUnique({
      where: { id: candidateId },
      include: { trial: { select: { id: true, title: true, nctId: true } } },
    });
    if (!candidate) return NextResponse.json({ error: 'No such candidate' }, { status: 404 });
    if (candidate.status !== 'PROPOSED') {
      return NextResponse.json(
        { error: `This candidate was already ${candidate.status.toLowerCase()}.` },
        { status: 409 },
      );
    }

    if (decision === 'reject') {
      await prisma.nctMatchCandidate.update({
        where: { id: candidate.id },
        data: { status: 'REJECTED', reviewedAt: new Date() },
      });
      return NextResponse.json({ status: 'REJECTED', message: `${candidate.nctId} rejected. The trial is unchanged.` });
    }

    if (candidate.trial.nctId && candidate.trial.nctId !== candidate.nctId) {
      return NextResponse.json(
        { error: `That trial is already linked to ${candidate.trial.nctId}. Unlink it first if that link is wrong.` },
        { status: 409 },
      );
    }

    const clash = await prisma.trial.findUnique({ where: { nctId: candidate.nctId }, select: { id: true, title: true } });
    if (clash && clash.id !== candidate.trialId) {
      return NextResponse.json(
        { error: `${candidate.nctId} is already attached to another trial ("${clash.title}"). One NCT number, one trial.` },
        { status: 409 },
      );
    }

    // One transaction so a trial can never end up linked without its candidate
    // row recording who decided that. Confirming also closes the trial's other
    // open proposals: once a human has picked one, the rest are answered.
    await prisma.$transaction([
      prisma.trial.update({ where: { id: candidate.trialId }, data: { nctId: candidate.nctId } }),
      prisma.nctMatchCandidate.update({
        where: { id: candidate.id },
        data: { status: 'CONFIRMED', reviewedAt: new Date() },
      }),
      prisma.nctMatchCandidate.updateMany({
        where: { trialId: candidate.trialId, status: 'PROPOSED', NOT: { id: candidate.id } },
        data: { status: 'REJECTED', reviewedAt: new Date() },
      }),
    ]);

    // The NCT number is on the trial card, so kiosks should redraw.
    publishTreeUpdate({
      location: 'all',
      action: 'NCT_LINK_CONFIRMED',
      summary: `${candidate.nctId} linked to a trial after review`,
    });

    return NextResponse.json({
      status: 'CONFIRMED',
      message: `${candidate.nctId} is now linked to "${candidate.trial.title}".`,
    });
  } catch (e) {
    // A concurrent confirm of the same NCT loses the unique index race; say so.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'That NCT number was attached to another trial a moment ago. Reload the queue and look again.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message(e, 'Could not record that decision') }, { status: 500 });
  }
}

/**
 * Render the stored Json evidence for the review screen. A row whose evidence
 * will not parse still shows up in the queue — hiding it would quietly drop a
 * trial out of review — but it says plainly that its reasoning is unreadable.
 */
function readEvidence(raw: unknown): { evidenceLines: string[]; points: { label: string; value: number }[] } {
  const evidence = coerceEvidence(raw);
  if (!evidence) {
    return {
      evidenceLines: ['The stored reasoning for this proposal could not be read. Verify this one from scratch before confirming.'],
      points: [],
    };
  }
  return { evidenceLines: describeEvidence(evidence), points: evidence.points };
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
