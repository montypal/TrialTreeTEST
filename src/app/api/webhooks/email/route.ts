import { NextRequest, NextResponse } from 'next/server';
import {
  validateInboundParseToken,
  extractEmailAddress,
  isDomainAllowed,
  authorizedClinicianByEmail,
} from '@/lib/auth/verifyEmail';
import { processInboundMessage } from '@/lib/actions/processInbound';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inbound email webhook (SendGrid Inbound Parse).
 * Configure SendGrid: Settings → Inbound Parse → Add Host & URL →
 *   POST  https://<host>/api/webhooks/email?token=<INBOUND_PARSE_SECRET>
 * SendGrid posts multipart/form-data with fields: from, subject, text, html, ...
 */
export async function POST(req: NextRequest) {
  // 1. Shared-secret gate on the URL (rejects unauthenticated traffic).
  const token = new URL(req.url).searchParams.get('token');
  if (!validateInboundParseToken(token)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const form = await req.formData();
  const rawFrom = String(form.get('from') || '');
  const subject = String(form.get('subject') || '');
  const text = String(form.get('text') || '').trim();

  const email = extractEmailAddress(rawFrom);
  if (!email) return NextResponse.json({ error: 'Unparseable sender' }, { status: 400 });

  // 2. Domain allowlist.
  if (!isDomainAllowed(email)) {
    return NextResponse.json({ error: 'Sender domain not allowed' }, { status: 403 });
  }

  // 3. Sender must be a known, active clinician.
  const clinician = await authorizedClinicianByEmail(email);
  if (!clinician) {
    return NextResponse.json({ error: 'Sender not an authorized clinician' }, { status: 403 });
  }

  // Combine subject + body — clinicians often put the gist in the subject line.
  const message = [subject, text].filter(Boolean).join('\n').trim();
  if (!message) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  // 4. Parse + apply (or queue for review).
  const result = await processInboundMessage({
    source: 'EMAIL',
    sender: email,
    rawText: message,
    homeLocationSlug: clinician.location?.slug ?? null,
  });

  // SendGrid only needs a 2xx to mark the message processed.
  return NextResponse.json({ status: result.status, message: result.message });
}
