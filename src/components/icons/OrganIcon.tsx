import type { ReactNode } from 'react';
import type { CancerHue } from '@/lib/cancerColors';

// ---------------------------------------------------------------------------
// Hand-drawn line-art organ marks for the four GU disease categories.
//
// One style, one grid: every icon lives in the same 48×48 viewBox, is stroked
// (never filled) at 1.8 units in currentColor with rounded caps, and keeps a
// margin of roughly 7 units so the four marks carry the same optical weight
// when they sit side by side in the category grid. Filled dots are the single
// exception — they echo the filled nodes in the TrialTree logo mark.
//
// Each mark was cut back to the few strokes that survive at 48px. The kidney
// carries no ureter and the prostate no urethra, for instance: at icon size
// those tubes collided with the organ outline and read as scribble, and the
// hilum notch alone already says "kidney". Detail that does survive is the
// detail that distinguishes one organ from another.
//
// These are schematic, not diagnostic. The icon is decorative (aria-hidden);
// the card's text label carries the meaning.
// ---------------------------------------------------------------------------

export type OrganIconName = 'prostate' | 'bladder' | 'kidney' | 'other';

// cancerColors owns the hue vocabulary but has no plain text-only map — CHIP
// and CARD both bundle a background. Spelled out in full because Tailwind's
// JIT never sees an interpolated class name.
const HUE_TEXT: Record<CancerHue, string> = {
  blue: 'text-blue-600',
  purple: 'text-violet-600',
  orange: 'text-orange-600',
  slate: 'text-slate-500',
};

// Prostate: the bilobed gland split by its median sulcus, with a seminal
// vesicle resting on each shoulder. The vesicles are what stop the outline
// reading as a plain heart or peach, so they earn their two strokes.
const PROSTATE: ReactNode = (
  <>
    <path d="M24 16.8C25.4 15 28.4 13.8 31.4 14.2C36 14.8 39.2 18.4 39.6 23.4C40.2 30.6 33.4 37 24 37C14.6 37 7.8 30.6 8.4 23.4C8.8 18.4 12 14.8 16.6 14.2C19.6 13.8 22.6 15 24 16.8Z" />
    <path d="M24 18V34.2" opacity={0.5} />
    <ellipse cx="13.2" cy="13.2" rx="5" ry="2.6" transform="rotate(-18 13.2 13.2)" />
    <ellipse cx="34.8" cy="13.2" rx="5" ry="2.6" transform="rotate(18 34.8 13.2)" />
  </>
);

// Bladder: a pouch narrowing to the bladder neck, both ureters entering at the
// shoulders. An interior floor line was tried and dropped — with the two
// ureters above it, the mark turned into a face.
const BLADDER: ReactNode = (
  <>
    <path d="M24 11C31.2 11 37.2 16.6 37.6 23.6C38 29.6 33.2 35 27.2 37.6C25.4 38.4 22.6 38.4 20.8 37.6C14.8 35 10 29.6 10.4 23.6C10.8 16.6 16.8 11 24 11Z" />
    <path d="M14.2 17.6C12.2 14.8 10.8 11.8 10.2 8.6" />
    <path d="M33.8 17.6C35.8 14.8 37.2 11.8 37.8 8.6" />
    <path d="M22.4 37.9V42.4" />
    <path d="M25.6 37.9V42.4" />
  </>
);

// Kidney: the bean. Control points either side of the hilum are kept collinear
// with it so the notch stays a smooth concavity instead of pinching into a
// beak. The inner arc is the cortex.
const KIDNEY: ReactNode = (
  <>
    <path d="M23 8C31 8 37 14.8 37 24C37 33.2 31 40 23 40C17 40 12.2 37.2 11 32.8C10.2 29.7 15.4 27.6 15.4 24C15.4 20.4 10.2 18.3 11 15.2C12.2 10.8 17 8 23 8Z" />
    <path
      d="M24.2 13.4C28.9 14.9 31.7 19.1 31.7 24C31.7 28.9 28.9 33.1 24.2 34.6"
      opacity={0.5}
    />
  </>
);

// Other GU: a cell rather than an organ, because this bucket spans
// germ cell tumors, registries and cross-disease studies — no single organ
// would be honest.
const OTHER: ReactNode = (
  <>
    <path d="M24 8.6C29.4 8.2 34.2 10.4 37 14.2C39.8 18 40.6 22.6 39.4 27C38.2 31.4 34.8 35.2 30.4 37.6C26 40 20.6 40.2 16.6 38C12.6 35.8 9.6 31.8 8.6 27.2C7.6 22.6 8.8 18 11.8 14.4C14.8 10.8 18.6 9 24 8.6Z" />
    <circle cx="22.8" cy="23.6" r="6.8" />
    <circle cx="22.8" cy="23.6" r="2" fill="currentColor" stroke="none" />
    <circle cx="33" cy="17.6" r="1.5" fill="currentColor" stroke="none" opacity={0.7} />
    <circle cx="15" cy="31.4" r="1.3" fill="currentColor" stroke="none" opacity={0.7} />
  </>
);

const SHAPES: Record<OrganIconName, ReactNode> = {
  prostate: PROSTATE,
  bladder: BLADDER,
  kidney: KIDNEY,
  other: OTHER,
};

type OrganIconProps = {
  name: OrganIconName;
  /** Tint from the shared cancer palette — prostate blue, bladder violet, kidney orange. */
  hue: CancerHue;
  /** Sizing utilities. Pass the SAME value everywhere in a grid so the marks line up. */
  className?: string;
};

export function OrganIcon({ name, hue, className = 'h-12 w-12' }: OrganIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`${HUE_TEXT[hue]} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
