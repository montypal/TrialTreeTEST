import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pending
 * Returns low-confidence / failed actions awaiting human review, plus the most
 * recent applied actions for the audit feed. (Protect this behind your auth /
 * SSO middleware before production — see README "Security hardening".)
 */
export async function GET(_req: NextRequest) {
  const [pending, recent] = await Promise.all([
    prisma.actionLog.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.actionLog.findMany({
      where: { status: 'APPLIED' },
      orderBy: { appliedAt: 'desc' },
      take: 20,
    }),
  ]);

  return NextResponse.json({ pending, recent }, { headers: { 'Cache-Control': 'no-store' } });
}
