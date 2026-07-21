'use client';

import { QRCodeSVG } from 'qrcode.react';
import { locationLabel } from '@/lib/locations';

type Props = {
  locationSlug: string;
  /** Twilio number clinicians text. Falls back to the public env var. */
  smsNumber?: string;
};

/**
 * High-visibility QR code for the kiosk corner. Scanning it opens the phone's
 * SMS composer pre-addressed to the Twilio number with a pre-filled body, so an
 * update takes <5s: the clinician just appends the change and hits send.
 */
export function QRCodeBlock({ locationSlug, smsNumber }: Props) {
  const number = smsNumber || process.env.NEXT_PUBLIC_SMS_NUMBER || '+13105550100';
  const label = locationLabel(locationSlug);
  // sms: URI with prefilled body. `?&body=` maximizes cross-platform (iOS/Android) support.
  const body = `Update for ${label}: `;
  const href = `sms:${number}?&body=${encodeURIComponent(body)}`;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <QRCodeSVG value={href} size={132} level="M" marginSize={2} />
      <div className="max-w-[200px] text-slate-900">
        <div className="text-lg font-extrabold leading-tight">Update this board</div>
        <div className="mt-1 text-sm font-medium leading-snug text-slate-700">
          Scan to text a change. Closes/opens a trial in seconds — no login.
        </div>
        <div className="mt-1 font-mono text-xs text-slate-500">{number}</div>
      </div>
    </div>
  );
}
