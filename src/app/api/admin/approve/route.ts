import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { applyLoggedAction } from '@/lib/actions/executor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/approve   { "logId": "...", "decision": "approve" | "reject" }
 * Approving a queued low-confidence action runs it through the same executor
 * (and therefore fires the same real-time update to the kiosks).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { logId?: string; decision?: string } | null;
  if (!body?.logId || !body.decision) {
    return NextResponse.json({ error: 'logId and decision are required' }, { status: 400 });
  }

  if (body.decision === 'reject') {
    await prisma.actionLog.update({
      where: { id: body.logId },
      data: { status: 'REJECTED', resultMessage: 'Rejected by admin' },
    });
    return NextResponse.json({ status: 'REJECTED' });
  }

  if (body.decision === 'approve') {
    const result = await applyLoggedAction(body.logId);
    return NextResponse.json({ status: result.ok ? 'APPLIED' : 'FAILED', message: result.message });
  }

  return NextResponse.json({ error: 'decision must be approve or reject' }, { status: 400 });
}
