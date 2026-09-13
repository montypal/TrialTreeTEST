import type { NodeKind } from '@/types';

// ---------------------------------------------------------------------------
// Brand palette: each GU cancer wears its awareness-ribbon color.
//   Prostate → blue · Bladder → purple · Kidney (RCC) → orange
//
// This is the single source of truth for cancer → color. Tailwind's JIT only
// picks up class names written out in full, so every class string below is
// literal (never built by interpolation).
//
// Green is deliberately NOT a brand color: it's reserved for status
// ("recruiting", "live"), so it always means "open / active".
// ---------------------------------------------------------------------------

export type CancerHue = 'blue' | 'purple' | 'orange' | 'slate';

export const CANCER_HUE: Record<string, CancerHue> = {
  'Prostate Cancer': 'blue',
  'Bladder Cancer': 'purple',
  'Renal Cell Carcinoma': 'orange',
};

export function hueFor(cancerLabel: string | null | undefined): CancerHue {
  return (cancerLabel && CANCER_HUE[cancerLabel]) || 'slate';
}

/** The three cancers in display order — for legends and chips. */
export const CANCERS: { label: string; short: string; hue: CancerHue }[] = [
  { label: 'Prostate Cancer', short: 'Prostate', hue: 'blue' },
  { label: 'Bladder Cancer', short: 'Bladder', hue: 'purple' },
  { label: 'Renal Cell Carcinoma', short: 'Kidney', hue: 'orange' },
];

/** Thin brand stripe: the three ribbon colors in a row. */
export const RIBBON_STRIPE = 'bg-gradient-to-r from-blue-500 via-violet-500 to-orange-500';

/** Raw hex, for SVG fills. */
export const HUE_HEX: Record<CancerHue, string> = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  orange: '#f97316',
  slate: '#64748b',
};

export const DOT: Record<CancerHue, string> = {
  blue: 'bg-blue-500',
  purple: 'bg-violet-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-400',
};

export const CHIP: Record<CancerHue, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  slate: 'bg-slate-50 text-slate-700 ring-slate-200',
};

/** Welcome-screen cancer cards. */
export const CARD: Record<CancerHue, { grad: string; hover: string; badge: string; bar: string }> = {
  blue: {
    grad: 'from-blue-50 to-white',
    hover: 'hover:border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
    bar: 'bg-blue-500',
  },
  purple: {
    grad: 'from-violet-50 to-white',
    hover: 'hover:border-violet-300',
    badge: 'bg-violet-100 text-violet-700',
    bar: 'bg-violet-500',
  },
  orange: {
    grad: 'from-orange-50 to-white',
    hover: 'hover:border-orange-300',
    badge: 'bg-orange-100 text-orange-700',
    bar: 'bg-orange-500',
  },
  slate: {
    grad: 'from-slate-50 to-white',
    hover: 'hover:border-slate-300',
    badge: 'bg-slate-100 text-slate-700',
    bar: 'bg-slate-400',
  },
};

/**
 * Tree nodes are tinted by their cancer, fading from the root toward the
 * leaves (Cancer → Stage → Histology → Line). The axis is spelled out by the
 * node's tag text, so color is free to say which cancer you're in.
 * Orange accents use the 700/800 shades — orange-600 is too light for small
 * text on white.
 */
export const NODE: Record<CancerHue, Record<NodeKind, { box: string; accent: string }>> = {
  blue: {
    DISEASE_TYPE: { box: 'border-blue-300 bg-blue-100', accent: 'text-blue-800' },
    DISEASE_STATE: { box: 'border-blue-200 bg-blue-50', accent: 'text-blue-700' },
    BIOMARKER: { box: 'border-blue-200 bg-white', accent: 'text-blue-600' },
    LINE_OF_THERAPY: { box: 'border-slate-200 bg-white', accent: 'text-blue-600' },
  },
  purple: {
    DISEASE_TYPE: { box: 'border-violet-300 bg-violet-100', accent: 'text-violet-800' },
    DISEASE_STATE: { box: 'border-violet-200 bg-violet-50', accent: 'text-violet-700' },
    BIOMARKER: { box: 'border-violet-200 bg-white', accent: 'text-violet-600' },
    LINE_OF_THERAPY: { box: 'border-slate-200 bg-white', accent: 'text-violet-600' },
  },
  orange: {
    DISEASE_TYPE: { box: 'border-orange-300 bg-orange-100', accent: 'text-orange-800' },
    DISEASE_STATE: { box: 'border-orange-200 bg-orange-50', accent: 'text-orange-700' },
    BIOMARKER: { box: 'border-orange-200 bg-white', accent: 'text-orange-700' },
    LINE_OF_THERAPY: { box: 'border-slate-200 bg-white', accent: 'text-orange-700' },
  },
  slate: {
    DISEASE_TYPE: { box: 'border-slate-300 bg-slate-100', accent: 'text-slate-800' },
    DISEASE_STATE: { box: 'border-slate-200 bg-slate-50', accent: 'text-slate-700' },
    BIOMARKER: { box: 'border-slate-200 bg-white', accent: 'text-slate-600' },
    LINE_OF_THERAPY: { box: 'border-slate-200 bg-white', accent: 'text-slate-600' },
  },
};

/** Trial card border: the cancer's color while recruiting, neutral otherwise. */
export const TRIAL_BORDER: Record<CancerHue, string> = {
  blue: 'border-blue-300',
  purple: 'border-violet-300',
  orange: 'border-orange-300',
  slate: 'border-slate-300',
};
