import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Donor records. Server-only: import this from route handlers and server code,
// never from a 'use client' file. Donor names, emails and amounts are private,
// so nothing here is rendered on a public page and nothing here logs them.
// The only way in from outside is the token-gated /api/admin/donations route.
//
// Where the rest plugs in later:
//   • Receipts: once NONPROFIT below is filled in, a receipt is an email built
//     from the donation row and NONPROFIT.legalName / .ein. Send it, then call
//     markReceiptSent(id) so the stamp records that it actually went out.
//     Only say a gift is tax-deductible when NONPROFIT.taxDeductible is true.
//   • Thank-you emails: the same shape. Send, then markThankYouSent(id).
//     Only email a donor about updates when donor.newsletterOptIn is true.
//   • Stripe / PayPal: a webhook route verifies the provider's signature, then
//     calls recordDonation with method 'STRIPE' or 'PAYPAL' and the provider's
//     payment id as externalId. externalId is unique and recordDonation returns
//     the existing row for a repeated id, so a retried webhook is harmless.
// ---------------------------------------------------------------------------

/** Mirrors the DonationMethod enum in prisma/schema.prisma. */
export const DONATION_METHODS = ['CHECK', 'BANK_TRANSFER', 'STRIPE', 'PAYPAL', 'OTHER'] as const;
export type DonationMethodName = (typeof DONATION_METHODS)[number];

export function isDonationMethod(v: unknown): v is DonationMethodName {
  return typeof v === 'string' && (DONATION_METHODS as readonly string[]).includes(v);
}

/** Postgres INT is 32-bit; anything larger would fail at the database instead of here. */
const MAX_AMOUNT_CENTS = 2_147_483_647;
const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 2_000;
const MAX_EXTERNAL_ID_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// The organisation's own facts, for receipts. Read from the environment and
// null (or false) until set: an EIN is never hard-coded, and a receipt must
// not claim deductibility nobody has confirmed.
// ---------------------------------------------------------------------------

export type NonprofitFacts = {
  legalName: string | null;
  ein: string | null;
  taxDeductible: boolean;
};

export const NONPROFIT: NonprofitFacts = {
  legalName: envText('TRIALTREE_LEGAL_NAME'),
  ein: envText('TRIALTREE_EIN'),
  taxDeductible: process.env.TRIALTREE_TAX_DEDUCTIBLE === 'true',
};

function envText(key: string): string | null {
  const v = process.env[key]?.trim();
  return v ? v : null;
}

// ---------------------------------------------------------------------------
// Recording gifts
// ---------------------------------------------------------------------------

/** A rejected input. The message names the field, never the value. */
export class DonationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DonationValidationError';
  }
}

export type DonationWithDonor = Prisma.DonationGetPayload<{ include: { donor: true } }>;

export type RecordDonationInput = {
  name: string;
  /** Optional: a cheque can arrive with no email. When given, the donor is matched on it. */
  email?: string | null;
  /** Integer cents, never a float. */
  amountCents: number;
  /** ISO 4217 code; USD when omitted. */
  currency?: string | null;
  donatedAt: Date;
  method?: DonationMethodName | null;
  /** The payment provider's id, once Stripe/PayPal exist. */
  externalId?: string | null;
  notes?: string | null;
  /** Omitted leaves an existing donor's consent as it was; a new donor starts opted out. */
  newsletterOptIn?: boolean | null;
};

export type RecordDonationResult = {
  donation: DonationWithDonor;
  /** False when externalId was already recorded and the existing row came back. */
  created: boolean;
};

/**
 * Record one gift. The donor is upserted by email when there is one (so a
 * repeat donor stays one person) and created fresh when there is not. Donor
 * and donation are written in one transaction, so a failure leaves neither.
 */
export async function recordDonation(input: RecordDonationInput): Promise<RecordDonationResult> {
  const name = cleanText(input.name, MAX_NAME_LENGTH);
  if (!name) throw new DonationValidationError('A donor name is required.');

  const email = cleanEmail(input.email);

  const amountCents = input.amountCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > MAX_AMOUNT_CENTS) {
    throw new DonationValidationError('amountCents must be a positive whole number of cents.');
  }

  const currency = (input.currency ?? 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new DonationValidationError('currency must be a three-letter code such as USD.');
  }

  const donatedAt = input.donatedAt;
  if (!(donatedAt instanceof Date) || Number.isNaN(donatedAt.getTime())) {
    throw new DonationValidationError('donatedAt must be a valid date.');
  }

  const method: DonationMethodName = input.method ?? 'OTHER';
  if (!isDonationMethod(method)) {
    throw new DonationValidationError(`method must be one of ${DONATION_METHODS.join(', ')}.`);
  }

  const externalId = cleanText(input.externalId, MAX_EXTERNAL_ID_LENGTH);
  const notes = cleanText(input.notes, MAX_NOTES_LENGTH);
  const optIn = typeof input.newsletterOptIn === 'boolean' ? input.newsletterOptIn : null;

  return prisma.$transaction(async (tx): Promise<RecordDonationResult> => {
    if (externalId) {
      const existing = await tx.donation.findUnique({ where: { externalId }, include: { donor: true } });
      if (existing) return { donation: existing, created: false };
    }

    const donor = email
      ? await tx.donor.upsert({
          where: { email },
          create: { name, email, newsletterOptIn: optIn === true },
          // Latest spelling of the name wins; consent changes only when stated.
          update: { name, newsletterOptIn: optIn ?? undefined },
        })
      : await tx.donor.create({ data: { name, newsletterOptIn: optIn === true } });

    const donation = await tx.donation.create({
      data: { donorId: donor.id, amountCents, currency, donatedAt, method, externalId, notes },
      include: { donor: true },
    });
    return { donation, created: true };
  });
}

/** Newest gifts first, each with its donor. */
export async function listDonations({ limit = 200 }: { limit?: number } = {}): Promise<DonationWithDonor[]> {
  const take = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 200;
  return prisma.donation.findMany({
    orderBy: [{ donatedAt: 'desc' }, { createdAt: 'desc' }],
    take,
    include: { donor: true },
  });
}

// ---------------------------------------------------------------------------
// Follow-up stamps. Each records the first time it happened and is not moved
// by a second call, so a double-click cannot rewrite when a receipt went out.
// Null means there is no donation with that id.
// ---------------------------------------------------------------------------

type FollowUp = 'receiptSentAt' | 'thankYouSentAt' | 'acknowledgedAt';

export function markReceiptSent(id: string): Promise<DonationWithDonor | null> {
  return stamp(id, 'receiptSentAt');
}

export function markThankYouSent(id: string): Promise<DonationWithDonor | null> {
  return stamp(id, 'thankYouSentAt');
}

export function markAcknowledged(id: string): Promise<DonationWithDonor | null> {
  return stamp(id, 'acknowledgedAt');
}

async function stamp(id: string, field: FollowUp): Promise<DonationWithDonor | null> {
  const existing = await prisma.donation.findUnique({ where: { id }, include: { donor: true } });
  if (!existing) return null;
  if (existing[field]) return existing;

  const now = new Date();
  const data =
    field === 'receiptSentAt'
      ? { receiptSentAt: now }
      : field === 'thankYouSentAt'
        ? { thankYouSentAt: now }
        : { acknowledgedAt: now };
  return prisma.donation.update({ where: { id }, data, include: { donor: true } });
}

// --- helpers ---------------------------------------------------------------

function cleanText(v: string | null | undefined, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > max) throw new DonationValidationError(`A text field is longer than ${max} characters.`);
  return t;
}

function cleanEmail(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  if (!t) return null;
  if (t.length > 254 || !EMAIL_PATTERN.test(t)) {
    throw new DonationValidationError('email does not look like an email address.');
  }
  return t;
}
