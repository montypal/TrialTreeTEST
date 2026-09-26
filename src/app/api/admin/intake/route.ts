import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/intake
 * The review queue for everything the public forms produce: trial submissions
 * awaiting curation, open suggestions, and donor messages awaiting
 * moderation. Counts are returned alongside the rows so a dashboard can badge
 * the queue without a second request.
 *
 * ⚠️ THIS RESPONSE CONTAINS SUBMITTER CONTACT DETAILS — names, email
 * addresses and phone numbers belonging to real clinicians and members of the
 * public. It is currently gated the same way the rest of the dev/admin
 * surface is, `devToolsEnabled()`, which is a FEATURE FLAG AND NOT
 * AUTHENTICATION: it is off in production only until someone sets
 * ENABLE_DEV_SIMULATE=true. Real auth (SSO / middleware) must sit in front of
 * /api/admin/* before launch. /api/admin/pending has the same gap and the
 * same fix.
 */
export async function GET(_req: NextRequest) {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });

  // Capped at 100 each. This is a review queue, not an export — if it is ever
  // full, the answer is pagination, not a bigger number.
  const [submissions, suggestions, donorMessages] = await Promise.all([
    prisma.trialSubmission.findMany({
      where: { status: { in: ['PENDING', 'IN_REVIEW'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.suggestion.findMany({
      where: { status: { in: ['NEW', 'TRIAGED'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.donorMessage.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  return NextResponse.json(
    {
      counts: {
        submissions: submissions.length,
        suggestions: suggestions.length,
        donorMessages: donorMessages.length,
      },
      submissions,
      suggestions,
      donorMessages,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
