import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Validate Twilio's X-Twilio-Signature header.
 *
 * Twilio signs requests with: base64( HMAC-SHA1( fullUrl + sortedParamConcat, authToken ) )
 * where sortedParamConcat is every POST param appended as `key + value`, keys
 * sorted alphabetically. See https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * We reconstruct the exact URL Twilio called. Behind a proxy (Vercel, ngrok)
 * the inbound host can differ from the public one, so we prefer PUBLIC_BASE_URL.
 */
export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_WEBHOOK_SECRET;
  if (!authToken || !signature) return false;

  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  // Constant-time compare to avoid leaking timing information.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Build the canonical public URL Twilio signed against. */
export function publicWebhookUrl(pathname: string): string {
  const base = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${pathname}`;
}

/** Normalize phone numbers to E.164-ish for comparison (digits + leading +). */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (trimmed.startsWith('+')) return `+${digits}`;
  // Assume US if 10 digits.
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/** Is this phone number an active, authorized clinician? Returns the clinician or null. */
export async function authorizedClinicianByPhone(fromNumber: string) {
  const phone = normalizePhone(fromNumber);
  return prisma.clinician.findFirst({
    where: { phone, active: true },
    include: { location: true },
  });
}
