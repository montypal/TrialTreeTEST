import { prisma } from '@/lib/db';
import { parseClinicianMessage } from '@/lib/ai/parser';
import { ingestAction } from '@/lib/actions/executor';

// ---------------------------------------------------------------------------
// The single entry point both webhooks (SMS + email) call. It chains the two
// halves of the pipeline:
//   1. parseClinicianMessage()  — AI text -> validated ParsedAction
//   2. ingestAction()           — confidence gate: auto-apply or queue for review
// and always leaves an ActionLog row behind (even on parse failure) so nothing
// a clinician sends is silently dropped.
// ---------------------------------------------------------------------------

export type ProcessResult = {
  status: 'APPLIED' | 'PENDING_REVIEW' | 'FAILED';
  message: string;
  logId?: string;
};

export async function processInboundMessage(input: {
  source: 'SMS' | 'EMAIL';
  sender: string;
  rawText: string;
  /** Authorized sender's home institution, used when they don't name a site. */
  homeLocationSlug?: string | null;
}): Promise<ProcessResult> {
  const { source, sender, rawText, homeLocationSlug } = input;

  // 1. Parse. On failure, still record it for the admin review queue.
  const parsed = await parseClinicianMessage(rawText);
  if (!parsed.ok) {
    const log = await prisma.actionLog.create({
      data: {
        source,
        sender,
        rawText,
        status: 'FAILED',
        resultMessage: `Parse failed: ${parsed.error}`,
      },
    });
    return { status: 'FAILED', message: `Could not interpret that update (${parsed.error}).`, logId: log.id };
  }

  // 2. Confidence gate + DB mutation (see ingestAction in executor.ts):
  //    confidence >= AI_AUTOAPPLY_THRESHOLD  -> applied now, kiosks update live
  //    below threshold (or UNKNOWN)          -> PENDING_REVIEW for an admin
  const result = await ingestAction({ action: parsed.action, source, sender, rawText, homeLocationSlug });
  return { status: result.status, message: result.message, logId: result.logId };
}
