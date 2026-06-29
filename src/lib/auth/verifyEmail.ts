import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * SendGrid Inbound Parse does not sign payloads the way the Event Webhook does,
 * so we secure the endpoint with a shared secret appended to the Parse URL
 * (e.g. https://app/api/webhooks/email?token=XXXX) and then verify the sender.
 *
 * Defense in depth, in order:
 *   1. Shared-secret token on the URL (rejects random internet traffic).
 *   2. Sender domain allowlist (ALLOWED_EMAIL_DOMAINS).
 *   3. Sender must be an active, authorized Clinician in the DB.
 */
export function validateInboundParseToken(token: string | null): boolean {
  const secret = process.env.INBOUND_PARSE_SECRET;
  if (!secret || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** "Dr. Jane Doe <jane@mednet.ucla.edu>" -> "jane@mednet.ucla.edu" */
export function extractEmailAddress(rawFrom: string): string | null {
  const angle = rawFrom.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : rawFrom).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

export function isDomainAllowed(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export async function authorizedClinicianByEmail(email: string) {
  return prisma.clinician.findFirst({
    where: { email: email.toLowerCase(), active: true },
    include: { location: true },
  });
}
