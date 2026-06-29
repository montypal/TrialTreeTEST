import { NextRequest, NextResponse } from 'next/server';
import {
  validateTwilioSignature,
  publicWebhookUrl,
  authorizedClinicianByPhone,
} from '@/lib/auth/verifyTwilio';
import { processInboundMessage } from '@/lib/actions/processInbound';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inbound SMS webhook (Twilio Programmable Messaging).
 * Configure Twilio: Phone Number → Messaging → "A message comes in" →
 *   Webhook  POST  https://<host>/api/webhooks/sms
 *
 * Returns TwiML so Twilio can SMS a confirmation back to the clinician.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = typeof v === 'string' ? v : ''));

  // 1. Authenticity: the request must be signed by Twilio's auth token.
  const signature = req.headers.get('x-twilio-signature');
  const url = publicWebhookUrl('/api/webhooks/sms');
  if (!validateTwilioSignature(signature, url, params)) {
    return new NextResponse('Invalid Twilio signature', { status: 403 });
  }

  const from = params.From || '';
  const body = (params.Body || '').trim();

  // 2. Authorization: the sender must be an active, known clinician.
  const clinician = await authorizedClinicianByPhone(from);
  if (!clinician) {
    return twiml(`This number isn't authorized to update TrialTree. Contact your trial coordinator.`);
  }
  if (!body) return twiml('Empty message received — nothing to update.');

  // 3. Parse + apply (or queue for review), then confirm back to the clinician.
  const result = await processInboundMessage({
    source: 'SMS',
    sender: from,
    rawText: body,
    homeLocationSlug: clinician.location?.slug ?? null,
  });

  const prefix =
    result.status === 'APPLIED' ? '✅ Updated: ' : result.status === 'PENDING_REVIEW' ? '🕓 Queued for review: ' : '⚠️ ';
  return twiml(prefix + result.message);
}

/** Minimal TwiML response so Twilio replies to the clinician. */
function twiml(message: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
    message,
  )}</Message></Response>`;
  return new NextResponse(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  );
}
