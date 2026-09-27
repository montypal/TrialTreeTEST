import type { ReactNode } from 'react';
import type { CancerHue } from '@/lib/cancerColors';

// ---------------------------------------------------------------------------
// Small medical illustrations for the four GU disease categories.
//
// One style, one grid: every drawing lives in the same 48×48 viewBox, outlined
// at 1.7 units in currentColor with rounded caps, with the organ body washed in
// the same colour at low opacity and one or two anatomical landmarks picked out
// a shade darker. That two-tone treatment is what lets them read as pictures of
// organs rather than as glyphs, while staying flat enough to sit in a UI.
//
// No gradients, on purpose: an SVG gradient needs a document-unique id, and
// these render many times on one page (and in server components, where useId
// is not an option). Opacity on currentColor gives the same depth for free.
//
// Each drawing carries just enough anatomy to be told apart at 44px:
//   • Prostate — the gland wrapped around the urethra, sitting under a faint
//     bladder. The bladder is what makes it read as "prostate" and not as a
//     generic walnut; it is kept ghosted so it cannot be mistaken for the
//     bladder drawing.
//   • Bladder — a pouch with a fluid line, ureters entering at the shoulders
//     and the urethra below.
//   • Kidney — the bean, with the renal pelvis in the hilum and the ureter.
//   • Other GU — a testis with its epididymis and spermatic cord. Most of the
//     disease-specific trials in that branch are testicular germ-cell studies
//     (AGCT-1531, P3BEP, MAGESTIC); it also holds an adrenocortical study and
//     cross-disease cohorts, which no single organ can show.
//
// Schematic, not diagnostic. Always decorative (aria-hidden): the text label
// beside the drawing carries the meaning.
// ---------------------------------------------------------------------------

export type OrganIconName = 'prostate' | 'bladder' | 'kidney' | 'other';

// cancerColors owns the hue vocabulary but has no plain text-only map — CHIP
// and CARD both bundle a background. Spelled out in full because Tailwind's
// JIT never sees an interpolated class name.
const HUE_TEXT: Record<CancerHue, string> = {
  blue: 'text-blue-600',
  purple: 'text-violet-600',
  orange: 'text-orange-600',
  slate: 'text-slate-600',
};

const PROSTATE: ReactNode = (
  <>
    <path
      d="M12.6 19.6C9.6 16.4 9.6 11 13.6 7.8C16.4 5.6 20 4.6 24 4.6C28 4.6 31.6 5.6 34.4 7.8C38.4 11 38.4 16.4 35.4 19.6"
      strokeOpacity={0.3}
    />
    <path
      d="M24 18.2C30.2 18 36 19.8 36.8 24.4C37.8 30 31.6 37.4 24 39.6C16.4 37.4 10.2 30 11.2 24.4C12 19.8 17.8 18 24 18.2Z"
      fill="currentColor"
      fillOpacity={0.2}
    />
    <path d="M22.6 15V44M25.4 15V44" strokeOpacity={0.62} />
  </>
);

const BLADDER: ReactNode = (
  <>
    <path
      d="M24 10.5C31.6 10.5 37.8 16.4 38.2 23.8C38.6 30 33.6 35.6 27.4 38.2C25.4 39 22.6 39 20.6 38.2C14.4 35.6 9.4 30 9.8 23.8C10.2 16.4 16.4 10.5 24 10.5Z"
      fill="currentColor"
      fillOpacity={0.14}
      stroke="none"
    />
    <path
      d="M10.2 25.6C15 24 19.6 27 24 25.8C28.4 24.6 33 27.4 37.8 25.6C37.2 30.8 33 35.4 27.4 38.2C25.4 39 22.6 39 20.6 38.2C15 35.4 10.8 30.8 10.2 25.6Z"
      fill="currentColor"
      fillOpacity={0.32}
      stroke="none"
    />
    <path d="M10.4 25.6C15 24 19.6 27 24 25.8C28.4 24.6 33 27.4 37.6 25.6" strokeOpacity={0.55} />
    <path d="M24 10.5C31.6 10.5 37.8 16.4 38.2 23.8C38.6 30 33.6 35.6 27.4 38.2C25.4 39 22.6 39 20.6 38.2C14.4 35.6 9.4 30 9.8 23.8C10.2 16.4 16.4 10.5 24 10.5Z" />
    <path d="M14 16C12 13.6 11.6 10.8 12.6 8.2C13.2 6.6 12.8 5.4 11.6 4.6" />
    <path d="M34 16C36 13.6 36.4 10.8 35.4 8.2C34.8 6.6 35.2 5.4 36.4 4.6" />
    <path d="M22.3 38.6V43.2M25.7 38.6V43.2" />
  </>
);

const KIDNEY: ReactNode = (
  <>
    <path
      d="M26 6.5C34.4 6.5 40.2 13.9 40.2 23.2C40.2 32.5 34.4 40 26 40C19.6 40 15.2 36.6 14.3 32.2C13.6 29.1 17.7 27.1 17.7 23.3C17.7 19.5 13.6 17.5 14.3 14.4C15.2 10 19.6 6.5 26 6.5Z"
      fill="currentColor"
      fillOpacity={0.16}
    />
    <path d="M27 11.2C32.4 12.6 35.6 17.4 35.6 23.2C35.6 29 32.4 33.8 27 35.2" strokeOpacity={0.45} />
    <path
      d="M18.4 19.4C21.4 18.2 25.2 18.9 27.2 21.2C28.2 22.4 28.2 24.2 27.2 25.4C25.2 27.7 21.4 28.4 18.4 27.2"
      fill="currentColor"
      fillOpacity={0.38}
      strokeOpacity={0.7}
    />
    <path d="M17.4 26.6C14.2 27.6 11.6 29.8 10.6 33.4L9.8 42" />
  </>
);

const TESTIS: ReactNode = (
  <>
    <path d="M26.2 15.4C26 11.6 25 8.6 23.2 5.4M29.8 15.2C30.2 11.4 29.8 8.2 28.6 5.2" />
    <path
      d="M27 40C31 41.2 34.6 39.2 36.4 35.2C38.4 30.6 38.6 24.6 37.4 19.6C36.8 16.8 35.4 13 33.6 9.2C32.8 7.6 32 6.2 31.4 5"
      strokeOpacity={0.6}
    />
    <ellipse
      cx="20.6"
      cy="29.4"
      rx="10.2"
      ry="12.6"
      transform="rotate(-8 20.6 29.4)"
      fill="currentColor"
      fillOpacity={0.16}
    />
    <path
      d="M24.6 16C29 13.8 34 15.4 35.4 19.8C36.6 24 35.2 32 31 37.6C29.6 39.6 27.4 41 25.8 40.4C28.4 35.8 30.4 29.6 30.2 24.4C30 20.6 28 17.6 24.6 16Z"
      fill="currentColor"
      fillOpacity={0.34}
    />
  </>
);

const SHAPES: Record<OrganIconName, ReactNode> = {
  prostate: PROSTATE,
  bladder: BLADDER,
  kidney: KIDNEY,
  other: TESTIS,
};

/** The drawing for a curated tree's root label. Anything unrecognised is "other". */
export function organFor(rootLabel: string | null | undefined): OrganIconName {
  switch (rootLabel) {
    case 'Prostate Cancer':
      return 'prostate';
    case 'Bladder Cancer':
      return 'bladder';
    case 'Renal Cell Carcinoma':
      return 'kidney';
    default:
      return 'other';
  }
}

type OrganIconProps = {
  name: OrganIconName;
  /** Tint from the shared cancer palette — prostate blue, bladder violet, kidney orange. */
  hue: CancerHue;
  /** Sizing utilities. Pass the SAME value everywhere in a grid so the drawings line up. */
  className?: string;
};

export function OrganIcon({ name, hue, className = 'h-12 w-12' }: OrganIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`${HUE_TEXT[hue]} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {SHAPES[name]}
    </svg>
  );
}
