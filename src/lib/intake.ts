import { z } from 'zod';

// ---------------------------------------------------------------------------
// Validation + plumbing for the public intake forms: trial submission (§4),
// suggestion (§5) and message of support (§6).
//
// Deliberately free of `next/server` and of every Node-only import. The forms
// are client components, and sharing these exact schemas with them is the only
// way browser-side and server-side validation can be guaranteed to agree. The
// route handlers return the plain web `Response` the helpers below build.
// ---------------------------------------------------------------------------

// Every string is capped. A public POST is an open write into Postgres, so the
// cap is the whole difference between a feedback box and somewhere to dump
// megabytes. Generous for a person typing into a form, stingy for anything else.
const LIMITS = {
  short: 120, // names, phases, roles, protocol numbers
  medium: 300, // trial titles, institution names
  long: 4000, // free-text notes and messages
  email: 200,
  phone: 40,
  id: 60, // a cuid is 25 chars; the slack is for future id formats
} as const;

// Loose on purpose. The only real test of an email address is sending to it,
// and a strict regex mostly succeeds at rejecting valid unusual addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NCT_RE = /^NCT\d{8}$/;

/** Required free text: trimmed, non-empty, length-capped. */
function requiredText(max: number, label: string) {
  return z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} is required.` })
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, `${label} is required.`);
}

/** Optional free text. Missing, null and '' all normalize to null. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .nullable()
    .transform((v): string | null => {
      const trimmed = (v ?? '').trim();
      return trimmed.length > 0 ? trimmed : null;
    });
}

const requiredEmail = z
  .string({ required_error: 'An email address is required.', invalid_type_error: 'An email address is required.' })
  .max(LIMITS.email, `Email must be ${LIMITS.email} characters or fewer.`)
  .transform((v) => v.trim())
  .refine((v) => EMAIL_RE.test(v), 'Enter a valid email address.');

const optionalEmail = z
  .string()
  .max(LIMITS.email, `Email must be ${LIMITS.email} characters or fewer.`)
  .optional()
  .nullable()
  .transform((v): string | null => {
    const trimmed = (v ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((v) => v === null || EMAIL_RE.test(v), 'Enter a valid email address, or leave it blank.');

// NCT ids are normalized to upper case on the way in so "nct04123456" and
// "NCT04123456" don't become two different rows for a reviewer to reconcile.
const optionalNctId = z
  .string()
  .max(32, 'That does not look like an NCT number.')
  .optional()
  .nullable()
  .transform((v): string | null => {
    const trimmed = (v ?? '').trim().toUpperCase();
    return trimmed.length > 0 ? trimmed : null;
  })
  .refine((v) => v === null || NCT_RE.test(v), 'An NCT number looks like NCT01234567.');

// Honeypot. The form renders a `website` input hidden from people and from
// screen readers; a person never fills it in, a naive bot fills every field it
// finds. It costs nothing, needs no third party, and catches the cheap traffic.
// It is not a captcha and must not be mistaken for one.
const honeypot = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || v.trim().length === 0, 'This submission looks automated.');

// --- Trial submission (brief §4) -------------------------------------------
// Only title, institution, submitter name and submitter email are required.
// A coordinator working from a protocol binder often has no NCT number yet,
// and rejecting the form over a missing field loses the trial entirely.
export const trialSubmissionSchema = z.object({
  nctId: optionalNctId,
  title: requiredText(LIMITS.medium, 'Trial title'),
  protocolNumber: optionalText(LIMITS.short, 'Protocol or IRB number'),
  phase: optionalText(LIMITS.short, 'Phase'),
  diseaseArea: optionalText(LIMITS.short, 'Disease area'),
  institution: requiredText(LIMITS.medium, 'Institution'),
  institutionSite: optionalText(LIMITS.medium, 'Department or site'),
  principalInvestigator: optionalText(LIMITS.short, 'Principal investigator'),
  submitterName: requiredText(LIMITS.short, 'Your name'),
  submitterEmail: requiredEmail,
  submitterPhone: optionalText(LIMITS.phone, 'Phone number'),
  submitterRole: optionalText(LIMITS.short, 'Your role'),
  notes: optionalText(LIMITS.long, 'Notes'),
  website: honeypot,
});

export type TrialSubmissionInput = z.input<typeof trialSubmissionSchema>;
export type TrialSubmissionValues = z.output<typeof trialSubmissionSchema>;

// --- Suggestion (brief §5) --------------------------------------------------
export const SUGGESTION_KINDS = ['MISSING_TRIAL', 'INCORRECT_INFO', 'GENERAL_FEEDBACK'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

/** Labels for the radio group / select, so the form and the API cannot drift. */
export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = {
  MISSING_TRIAL: 'A trial is missing',
  INCORRECT_INFO: 'Something here is wrong or out of date',
  GENERAL_FEEDBACK: 'General feedback',
};

export const suggestionSchema = z.object({
  kind: z.enum(SUGGESTION_KINDS, {
    errorMap: () => ({ message: 'Choose what your suggestion is about.' }),
  }),
  nctId: optionalNctId,
  message: requiredText(LIMITS.long, 'Message'),
  contactEmail: optionalEmail,
  // Sent by the UI when the suggestion was opened from a specific trial panel.
  // Stored as a bare id, never as a relation — see the schema comment.
  relatedTrialId: optionalText(LIMITS.id, 'Trial reference'),
  website: honeypot,
});

export type SuggestionInput = z.input<typeof suggestionSchema>;
export type SuggestionValues = z.output<typeof suggestionSchema>;

// --- Message of support (brief §6) ------------------------------------------
// No route posts this yet; the schema lives here so that when one does, the
// moderation contract is already written down next to the other two.
export const donorMessageSchema = z.object({
  displayName: requiredText(LIMITS.short, 'Display name'),
  message: optionalText(LIMITS.long, 'Message'),
  website: honeypot,
});

export type DonorMessageInput = z.input<typeof donorMessageSchema>;
export type DonorMessageValues = z.output<typeof donorMessageSchema>;

// --- JSON responses ---------------------------------------------------------
export type FieldErrors = Record<string, string[]>;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** 200 `{ ok: true, ...payload }`. */
export function ok(payload: Record<string, unknown> = {}): Response {
  return json({ ok: true, ...payload }, 200);
}

/** 400 `{ ok: false, error, fieldErrors }`. */
export function badRequest(error: string, fieldErrors: FieldErrors = {}): Response {
  return json({ ok: false, error, fieldErrors }, 400);
}

/** 500 `{ ok: false, error }`. The real cause is logged, never returned. */
export function serverError(error: string): Response {
  return json({ ok: false, error }, 500);
}

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, messages] of Object.entries(error.flatten().fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) out[key] = messages;
  }
  return out;
}

/**
 * Split a validation failure into a top-level message plus per-field messages.
 * The honeypot is pulled out of the field list: `website` is hidden from real
 * people, so an error on it belongs in the headline, never as a message beside
 * an input nobody can see.
 */
export function intakeErrors(error: z.ZodError): { message: string; fieldErrors: FieldErrors } {
  const fieldErrors = fieldErrorsFrom(error);
  if (fieldErrors.website) {
    delete fieldErrors.website;
    return {
      // No contact address is published anywhere, so do not point at one.
      message: 'This submission looks automated. If that is wrong, please reload the page and try again.',
      fieldErrors,
    };
  }
  return { message: 'Please check the highlighted fields and try again.', fieldErrors };
}

// --- Crude rate limiting ----------------------------------------------------
// A Map on this server instance, a one-minute window, nothing shared between
// instances and nothing that survives a restart or a cold start.
//
// Be honest about what this is: it stops one browser leaning on the submit
// button and it stops a single-IP script. It does NOT stop a distributed bot,
// and it is NOT a substitute for a real rate limiter or a captcha at the edge.
// Put one in front of these routes before launch.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

/**
 * Best guess at the caller's IP. Behind Railway's proxy the left-most
 * x-forwarded-for entry is the client; it is client-controlled and trivially
 * spoofed, which is exactly why the limit above is described as best-effort.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip')?.trim();
  return real && real.length > 0 ? real : 'unknown';
}

/** Returns false when the caller has spent its allowance for this window. */
export function rateLimit(key: string, limit: number = MAX_PER_WINDOW, windowMs: number = WINDOW_MS): boolean {
  const now = Date.now();

  // Sweep expired buckets on the way past so the Map cannot grow without bound
  // on a long-lived instance. Cheap at this traffic; revisit if it ever isn't.
  if (buckets.size > 500) {
    for (const [k, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/** 429 `{ ok: false, error }`. */
export function tooManyRequests(): Response {
  return json(
    { ok: false, error: 'Too many submissions from this network. Please wait a minute and try again.' },
    429,
  );
}

/** Body parse that never throws — an empty/!JSON body just fails validation. */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
