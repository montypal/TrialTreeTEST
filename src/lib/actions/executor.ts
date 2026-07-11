import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { publishTreeUpdate } from '@/lib/events';
import { resolveLocationSlug, locationLabel } from '@/lib/locations';
import type { ParsedAction } from '@/lib/ai/schema';

function autoApplyThreshold(): number {
  const n = Number(process.env.AI_AUTOAPPLY_THRESHOLD);
  return Number.isFinite(n) ? n : 85;
}

export type IngestInput = {
  action: ParsedAction;
  source: 'SMS' | 'EMAIL' | 'ADMIN';
  sender: string;
  rawText: string;
  /** Home institution of the authorized sender, used when no location is named. */
  homeLocationSlug?: string | null;
};

export type IngestResult = {
  logId: string;
  status: 'APPLIED' | 'PENDING_REVIEW' | 'FAILED';
  message: string;
};

/**
 * Persist an inbound action, then auto-apply it when confidence is high enough.
 * Always writes an ActionLog row (the audit trail + admin review queue).
 */
export async function ingestAction(input: IngestInput): Promise<IngestResult> {
  const { action, source, sender, rawText, homeLocationSlug } = input;
  const threshold = autoApplyThreshold();

  const log = await prisma.actionLog.create({
    data: {
      source,
      sender,
      rawText,
      action: action.action,
      targetIdentifier: action.target_trial_identifier as unknown as Prisma.InputJsonValue,
      locationGuess: action.location,
      payload: action.payload as unknown as Prisma.InputJsonValue,
      confidence: Math.round(action.confidence_score),
      reasoning: action.reasoning,
      status: 'PENDING_REVIEW',
    },
  });

  if (action.action === 'UNKNOWN' || action.confidence_score < threshold) {
    return {
      logId: log.id,
      status: 'PENDING_REVIEW',
      message:
        action.action === 'UNKNOWN'
          ? 'Message did not map to a supported action — queued for review.'
          : `Confidence ${Math.round(action.confidence_score)}% is below the ${threshold}% auto-apply threshold — queued for admin approval.`,
    };
  }

  const applied = await applyAction(action, homeLocationSlug ?? null);
  await prisma.actionLog.update({
    where: { id: log.id },
    data: {
      status: applied.ok ? 'APPLIED' : 'FAILED',
      resultMessage: applied.message,
      resolvedTrialId: applied.trialId ?? null,
      appliedAt: applied.ok ? new Date() : null,
    },
  });

  return {
    logId: log.id,
    status: applied.ok ? 'APPLIED' : 'FAILED',
    message: applied.message,
  };
}

/** Apply an already-reviewed log row (admin approval path). */
export async function applyLoggedAction(logId: string): Promise<{ ok: boolean; message: string }> {
  const log = await prisma.actionLog.findUnique({ where: { id: logId } });
  if (!log) return { ok: false, message: 'Action log not found.' };

  const action: ParsedAction = {
    action: (log.action as ParsedAction['action']) ?? 'UNKNOWN',
    target_trial_identifier: log.targetIdentifier as ParsedAction['target_trial_identifier'],
    location: log.locationGuess,
    payload: log.payload as ParsedAction['payload'],
    confidence_score: log.confidence ?? 0,
    reasoning: log.reasoning ?? '',
  };

  const result = await applyAction(action, null);
  await prisma.actionLog.update({
    where: { id: logId },
    data: {
      status: result.ok ? 'APPLIED' : 'FAILED',
      resultMessage: result.message,
      resolvedTrialId: result.trialId ?? null,
      appliedAt: result.ok ? new Date() : null,
    },
  });
  return { ok: result.ok, message: result.message };
}

// --- Core mutation logic ---------------------------------------------------

type ApplyOutcome = { ok: boolean; message: string; trialId?: string; locationSlug?: string };

export async function applyAction(
  action: ParsedAction,
  homeLocationSlug: string | null,
): Promise<ApplyOutcome> {
  const trial = await resolveTrial(action.target_trial_identifier);
  if (!trial.ok) return { ok: false, message: trial.message };

  const locationSlug = resolveLocationSlug(action.location) ?? homeLocationSlug;

  switch (action.action) {
    case 'OPEN_TRIAL':
    case 'CLOSE_TRIAL': {
      if (!locationSlug) {
        return { ok: false, message: 'No location named and sender has no home institution.' };
      }
      const status =
        action.payload.new_status ?? (action.action === 'OPEN_TRIAL' ? 'RECRUITING' : 'CLOSED');
      const location = await prisma.location.findUnique({ where: { slug: locationSlug } });
      if (!location) return { ok: false, message: `Unknown location: ${locationSlug}` };

      // manualOverride marks this as a human decision so the ClinicalTrials.gov
      // importer won't revert it on the next sync.
      await prisma.trialLocation.upsert({
        where: { trialId_locationId: { trialId: trial.id, locationId: location.id } },
        update: { status, manualOverride: true, source: 'MANUAL' },
        create: { trialId: trial.id, locationId: location.id, status, manualOverride: true, source: 'MANUAL' },
      });

      const summary = `${trial.title} → ${status} at ${locationLabel(locationSlug)}`;
      publishTreeUpdate({ location: locationSlug, action: action.action, summary });
      // Also notify the global/admin view.
      publishTreeUpdate({ location: 'all', action: action.action, summary });
      return { ok: true, message: summary, trialId: trial.id, locationSlug };
    }

    case 'ADD_COHORT': {
      const label = action.payload.cohort_label?.trim();
      if (!label) return { ok: false, message: 'ADD_COHORT requires a cohort label.' };
      await prisma.cohort.create({
        data: { trialId: trial.id, label, status: action.payload.new_status ?? 'RECRUITING' },
      });
      const summary = `Added cohort "${label}" to ${trial.title}`;
      publishTreeUpdate({ location: locationSlug ?? 'all', action: 'ADD_COHORT', summary });
      if (locationSlug) publishTreeUpdate({ location: 'all', action: 'ADD_COHORT', summary });
      return { ok: true, message: summary, trialId: trial.id, locationSlug: locationSlug ?? undefined };
    }

    case 'UPDATE_CRITERIA': {
      const text = action.payload.criteria_text?.trim();
      if (!text) return { ok: false, message: 'UPDATE_CRITERIA requires criteria_text.' };
      // criteriaOverride stops the CT.gov importer from overwriting this edit.
      await prisma.trial.update({
        where: { id: trial.id },
        data: { eligibilityCriteria: text, criteriaOverride: true },
      });
      const summary = `Updated eligibility criteria for ${trial.title}`;
      publishTreeUpdate({ location: locationSlug ?? 'all', action: 'UPDATE_CRITERIA', summary });
      if (locationSlug) publishTreeUpdate({ location: 'all', action: 'UPDATE_CRITERIA', summary });
      return { ok: true, message: summary, trialId: trial.id, locationSlug: locationSlug ?? undefined };
    }

    default:
      return { ok: false, message: `Unsupported action: ${action.action}` };
  }
}

// --- Trial resolution ------------------------------------------------------

type TrialResolution = { ok: true; id: string; title: string } | { ok: false; message: string };

async function resolveTrial(
  ident: ParsedAction['target_trial_identifier'],
): Promise<TrialResolution> {
  // 1. NCT id (most specific).
  if (ident.nct_id) {
    const t = await prisma.trial.findUnique({ where: { nctId: ident.nct_id } });
    if (t) return { ok: true, id: t.id, title: t.title };
    return { ok: false, message: `No trial found for ${ident.nct_id}.` };
  }

  // 2. Protocol number.
  if (ident.protocol_number) {
    const t = await prisma.trial.findFirst({
      where: { protocolNumber: { equals: ident.protocol_number, mode: 'insensitive' } },
    });
    if (t) return { ok: true, id: t.id, title: t.title };
    return { ok: false, message: `No trial found for protocol ${ident.protocol_number}.` };
  }

  // 3. Shorthand / fuzzy title match.
  if (ident.shorthand) {
    const q = ident.shorthand.trim();
    const candidates = await prisma.trial.findMany({
      where: {
        OR: [
          { shorthand: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });
    if (candidates.length === 1) return { ok: true, id: candidates[0].id, title: candidates[0].title };
    if (candidates.length === 0) {
      // Fall back to keyword overlap on the title (e.g. "bladder" + "phase ii").
      const tokens = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const byToken = await prisma.trial.findMany({
        where: { AND: tokens.map((tok) => ({ title: { contains: tok, mode: 'insensitive' as const } })) },
        take: 5,
      });
      if (byToken.length === 1) return { ok: true, id: byToken[0].id, title: byToken[0].title };
      return { ok: false, message: `Could not match "${q}" to a single trial (${byToken.length} candidates).` };
    }
    return { ok: false, message: `"${q}" matched ${candidates.length} trials — ambiguous.` };
  }

  return { ok: false, message: 'No trial identifier (NCT id, protocol number, or shorthand) provided.' };
}
