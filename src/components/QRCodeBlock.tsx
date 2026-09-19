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
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl sm:gap-4 sm:rounded-2xl sm:p-4">
      {/* The SVG has a viewBox, so CSS scales the 132px code down to 88px on
          phones (pure CSS, so it stays SSR-safe). */}
      <QRCodeSVG
        value={href}
        size={132}
        level="M"
        marginSize={2}
        className="h-[88px] w-[88px] shrink-0 sm:h-[132px] sm:w-[132px]"
      />
      <div className="max-w-[200px] text-slate-900">
        <div className="text-sm font-extrabold leading-tight sm:text-lg">Update this board</div>
        <div className="mt-1 hidden text-sm font-medium leading-snug text-slate-700 sm:block">
          Scan to text a change. Closes/opens a trial in seconds — no login.
        </div>
        <div className="mt-1 font-mono text-xs text-slate-500">{number}</div>
      </div>
    </div>
  );
}
