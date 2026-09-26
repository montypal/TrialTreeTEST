import { prisma } from '@/lib/db';
import {
  badRequest,
  clientIp,
  intakeErrors,
  ok,
  rateLimit,
  readJsonBody,
  serverError,
  tooManyRequests,
  trialSubmissionSchema,
} from '@/lib/intake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/submissions
 *
 * The public "submit a trial" form (brief §4). The request body is exactly
 * `trialSubmissionSchema` in src/lib/intake.ts — that schema is the contract,
 * so the form imports it rather than re-describing the shape.
 *
 * Nothing posted here reaches the tree. Every row lands as PENDING and a
 * curator has to transcribe an approved submission into curatedData.ts by
 * hand. That human step is the point: on a clinical platform an anonymous
 * POST must never be able to put a trial in front of a patient.
 */
export async function POST(req: Request) {
  if (!rateLimit(`submissions:${clientIp(req)}`)) return tooManyRequests();

  const parsed = trialSubmissionSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) {
    const { message, fieldErrors } = intakeErrors(parsed.error);
    return badRequest(message, fieldErrors);
  }

  const v = parsed.data;
  try {
    const row = await prisma.trialSubmission.create({
      data: {
        nctId: v.nctId,
        title: v.title,
        protocolNumber: v.protocolNumber,
        phase: v.phase,
        diseaseArea: v.diseaseArea,
        institution: v.institution,
        institutionSite: v.institutionSite,
        principalInvestigator: v.principalInvestigator,
        submitterName: v.submitterName,
        submitterEmail: v.submitterEmail,
        submitterPhone: v.submitterPhone,
        submitterRole: v.submitterRole,
        notes: v.notes,
        // Explicit even though it is the column default. This is the single
        // line that guarantees a submission cannot arrive already approved.
        status: 'PENDING',
      },
      select: { id: true },
    });
    return ok({ id: row.id, status: 'PENDING' });
  } catch (e) {
    // The submitter gets a generic message; the detail stays in the logs,
    // because the failing payload contains their own contact details.
    console.error('[api/submissions] create failed', e);
    return serverError('We could not save your submission. Please try again in a moment.');
  }
}
