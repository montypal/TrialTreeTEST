import { prisma } from '@/lib/db';
import {
  badRequest,
  clientIp,
  intakeErrors,
  ok,
  rateLimit,
  readJsonBody,
  serverError,
  suggestionSchema,
  tooManyRequests,
} from '@/lib/intake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/suggestions
 *
 * Lightweight public feedback (brief §5): a missing trial, something that
 * looks wrong, or a general note. The request body is exactly
 * `suggestionSchema` in src/lib/intake.ts.
 *
 * Every row lands as NEW. A suggestion never edits a trial — it only tells a
 * human to go and look, which is the only safe way to let the public correct
 * clinical data.
 */
export async function POST(req: Request) {
  if (!rateLimit(`suggestions:${clientIp(req)}`)) return tooManyRequests();

  const parsed = suggestionSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    const { message, fieldErrors } = intakeErrors(parsed.error);
    return badRequest(message, fieldErrors);
  }

  const v = parsed.data;
  try {
    const row = await prisma.suggestion.create({
      data: {
        kind: v.kind,
        nctId: v.nctId,
        message: v.message,
        contactEmail: v.contactEmail,
        // Stored as a bare id on purpose — a curated reload recreates every
        // trial, and a real foreign key would delete the feedback with it.
        relatedTrialId: v.relatedTrialId,
        status: 'NEW',
      },
      select: { id: true },
    });
    return ok({ id: row.id, status: 'NEW' });
  } catch (e) {
    console.error('[api/suggestions] create failed', e);
    return serverError('We could not save your suggestion. Please try again in a moment.');
  }
}
