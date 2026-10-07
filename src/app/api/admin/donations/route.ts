import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  DONATION_METHODS,
  DonationValidationError,
  NONPROFIT,
  isDonationMethod,
  listDonations,
  recordDonation,
  type DonationWithDonor,
  type RecordDonationInput,
} from '@/lib/donors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Private donor records. Fails closed:
//   • DONOR_ADMIN_TOKEN unset or shorter than 24 characters → 404, as if the
//     route did not exist, so a half-configured deploy exposes nothing;
//   • otherwise "Authorization: Bearer <token>" is required, compared in
//     constant time → 401 when it does not match.
//
//   GET  → the latest 200 donations with their donors
//   POST → record one donation (see RecordDonationInput in src/lib/donors.ts)
//
// Nothing here logs a donor's name, email or amount, and error responses
// never echo the request back. Logs carry an error code at most.
// ---------------------------------------------------------------------------

const MIN_TOKEN_LENGTH = 24;
const LIST_LIMIT = 200;
const NO_STORE = { 'Cache-Control': 'no-store' };
/** "2026-10-06", optionally with a time and a Z or ±hh:mm offset. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Null when the caller may proceed; otherwise the response to send. */
function deny(req: NextRequest): NextResponse | null {
  const secret = process.env.DONOR_ADMIN_TOKEN?.trim() ?? '';
  if (secret.length < MIN_TOKEN_LENGTH) return new NextResponse('Not found', { status: 404 });

  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const presented = Buffer.from(match ? match[1] : '', 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  // timingSafeEqual throws on unequal lengths, so the length check comes first.
  const ok = presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
  if (ok) return null;

  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { ...NO_STORE, 'WWW-Authenticate': 'Bearer' } },
  );
}

export async function GET(req: NextRequest) {
  const denied = deny(req);
  if (denied) return denied;

  try {
    const donations = await listDonations({ limit: LIST_LIMIT });
    return NextResponse.json(
      { nonprofit: NONPROFIT, count: donations.length, donations: donations.map(serialize) },
      { headers: NO_STORE },
    );
  } catch (e) {
    console.error('[admin/donations] list failed', errorCode(e));
    return NextResponse.json({ error: 'Could not load donations.' }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: NextRequest) {
  const denied = deny(req);
  if (denied) return denied;

  const body: unknown = await req.json().catch(() => null);
  const parsed = parseDonation(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  try {
    const { donation, created } = await recordDonation(parsed.input);
    return NextResponse.json(
      { status: created ? 'RECORDED' : 'ALREADY_RECORDED', donation: serialize(donation) },
      { status: created ? 201 : 200, headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof DonationValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers: NO_STORE });
    }
    // A concurrent write took the same externalId or donor email first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'That donation or donor was recorded a moment ago. Reload and check before retrying.' },
        { status: 409, headers: NO_STORE },
      );
    }
    console.error('[admin/donations] record failed', errorCode(e));
    return NextResponse.json({ error: 'Could not record the donation.' }, { status: 500, headers: NO_STORE });
  }
}

// --- body parsing ----------------------------------------------------------

type Parsed = { ok: true; input: RecordDonationInput } | { ok: false; error: string };

/**
 * Check the JSON's shape and types. recordDonation then checks the values
 * (positive integer cents, currency code, email form), so the rules live in
 * one place. Messages name the field and never repeat what was sent.
 */
function parseDonation(body: unknown): Parsed {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Send a JSON object.' };
  }
  const b = body as Record<string, unknown>;

  const name = b.name;
  if (typeof name !== 'string') return { ok: false, error: '"name" is required.' };

  const amountCents = b.amountCents;
  if (typeof amountCents !== 'number') {
    return { ok: false, error: '"amountCents" must be a positive whole number of cents.' };
  }

  const donatedAtRaw = b.donatedAt;
  // Receipts and tax-year reporting hang off this date, so only an unambiguous
  // ISO date is accepted ("2026-10-06" or a full timestamp), never whatever
  // the JavaScript date parser can make of "5/3/26", and never a future day.
  if (typeof donatedAtRaw !== 'string' || !ISO_DATE.test(donatedAtRaw.trim())) {
    return { ok: false, error: '"donatedAt" must be an ISO date string, e.g. "2026-10-06".' };
  }
  const donatedAt = new Date(donatedAtRaw.trim());
  if (Number.isNaN(donatedAt.getTime())) return { ok: false, error: '"donatedAt" must be an ISO date string.' };
  // A bare date must be a real calendar day: the parser would roll "2026-02-30" into March.
  if (donatedAtRaw.trim().length === 10 && donatedAt.toISOString().slice(0, 10) !== donatedAtRaw.trim()) {
    return { ok: false, error: '"donatedAt" is not a real calendar date.' };
  }
  if (donatedAt.getTime() > Date.now() + 86_400_000) {
    return { ok: false, error: '"donatedAt" cannot be in the future.' };
  }

  const email = optionalString(b.email);
  const currency = optionalString(b.currency);
  const externalId = optionalString(b.externalId);
  const notes = optionalString(b.notes);
  if (email === undefined) return { ok: false, error: '"email" must be a string when given.' };
  if (currency === undefined) return { ok: false, error: '"currency" must be a string when given.' };
  if (externalId === undefined) return { ok: false, error: '"externalId" must be a string when given.' };
  if (notes === undefined) return { ok: false, error: '"notes" must be a string when given.' };

  const methodRaw = b.method;
  let method: RecordDonationInput['method'] = null;
  if (methodRaw !== undefined && methodRaw !== null) {
    if (!isDonationMethod(methodRaw)) {
      return { ok: false, error: `"method" must be one of ${DONATION_METHODS.join(', ')}.` };
    }
    method = methodRaw;
  }

  const optInRaw = b.newsletterOptIn;
  if (optInRaw !== undefined && optInRaw !== null && typeof optInRaw !== 'boolean') {
    return { ok: false, error: '"newsletterOptIn" must be true or false when given.' };
  }
  const newsletterOptIn = typeof optInRaw === 'boolean' ? optInRaw : null;

  return {
    ok: true,
    input: { name, email, amountCents, currency, donatedAt, method, externalId, notes, newsletterOptIn },
  };
}

/** A string or null when present-and-valid; undefined when the type is wrong. */
function optionalString(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === 'string' ? v : undefined;
}

// --- output ----------------------------------------------------------------

function serialize(d: DonationWithDonor) {
  return {
    id: d.id,
    amountCents: d.amountCents,
    currency: d.currency,
    donatedAt: d.donatedAt.toISOString(),
    method: d.method,
    externalId: d.externalId,
    notes: d.notes,
    receiptSentAt: iso(d.receiptSentAt),
    thankYouSentAt: iso(d.thankYouSentAt),
    acknowledgedAt: iso(d.acknowledgedAt),
    createdAt: d.createdAt.toISOString(),
    donor: {
      id: d.donor.id,
      name: d.donor.name,
      email: d.donor.email,
      newsletterOptIn: d.donor.newsletterOptIn,
    },
  };
}

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** Prisma's error code, or the error's class name. Never its message, which can echo the query's values. */
function errorCode(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code;
  return e instanceof Error ? e.name : 'unknown';
}
