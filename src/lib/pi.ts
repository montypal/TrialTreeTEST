// Normalize investigator names coming from ClinicalTrials.gov so the PI filter
// isn't full of credential variants ("Jane Doe, MD" vs "Jane Doe") and non-name
// junk ("Study Director", coordinators, org names).

const CREDENTIALS =
  /,?\s*\b(m\.?d\.?|ph\.?d\.?|d\.?o\.?|mbbs|m\.?sc?\.?|m\.?p\.?h\.?|r\.?n\.?|pharm\.?d\.?|faap|facp|fasco|msn|np|pa-?c|bsn|do|dds|dnp|ms)\b\.?/gi;

const NON_NAME_WORDS = [
  'study',
  'director',
  'coordinator',
  'contact',
  'sponsor',
  'clinical',
  'trial',
  'research',
  'oncology',
  'university',
  'hospital',
  'center',
  'centre',
  'medical',
  'institute',
  'department',
  'group',
  'office',
  'recruit',
  'inc',
  'llc',
  'corp',
  'pharma',
  'sciences',
  'health',
  'team',
  'unknown',
];

/** Returns a cleaned display name, or null if it isn't a real person's name. */
export function cleanPi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let n = raw.replace(CREDENTIALS, ' ').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return null;

  const low = n.toLowerCase();
  if (NON_NAME_WORDS.some((w) => low.includes(w))) return null;
  if (/\d/.test(n)) return null;

  const tokens = n.split(' ').filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return null; // want first + last, not a phrase
  if (tokens.every((t) => t.length <= 2)) return null; // all-initials / abbreviations

  // Title-case for consistent display.
  return tokens.map((t) => t[0].toUpperCase() + t.slice(1)).join(' ');
}

/** Case-insensitive key for de-duplicating cleaned names. */
export function piKey(name: string): string {
  return name.toLowerCase();
}
