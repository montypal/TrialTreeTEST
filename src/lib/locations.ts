// Canonical SoCal GU oncology centers + fuzzy resolution helpers.
// The AI parser returns a free-text institution name; we normalize it to a slug.

export type CenterDef = {
  slug: string;
  name: string;
  shortName: string;
  /** Lowercase strings the AI / clinicians might use to refer to this center. */
  aliases: string[];
};

export const CENTERS: CenterDef[] = [
  {
    slug: 'city-of-hope',
    name: 'City of Hope',
    shortName: 'COH',
    aliases: ['city of hope', 'coh', 'cityofhope', 'duarte'],
  },
  {
    slug: 'ucla',
    name: 'UCLA Health',
    shortName: 'UCLA',
    aliases: ['ucla', 'university of california los angeles', 'jonsson', 'westwood'],
  },
  {
    slug: 'ucsd',
    name: 'UC San Diego Health',
    shortName: 'UCSD',
    aliases: ['ucsd', 'uc san diego', 'university of california san diego', 'moores', 'la jolla'],
  },
  {
    slug: 'uci',
    name: 'UC Irvine Health',
    shortName: 'UCI',
    aliases: ['uci', 'uc irvine', 'university of california irvine', 'chao', 'irvine'],
  },
  {
    slug: 'usc',
    name: 'USC Norris',
    shortName: 'USC',
    aliases: ['usc', 'norris', 'keck', 'university of southern california'],
  },
];

const SLUG_SET = new Set(CENTERS.map((c) => c.slug));

export function isValidLocationSlug(slug: string): boolean {
  return SLUG_SET.has(slug);
}

export function centerBySlug(slug: string): CenterDef | undefined {
  return CENTERS.find((c) => c.slug === slug);
}

/** Resolve a free-text institution mention (or slug) to a canonical slug. */
export function resolveLocationSlug(input?: string | null): string | null {
  if (!input) return null;
  const q = input.trim().toLowerCase();
  if (SLUG_SET.has(q)) return q;
  for (const c of CENTERS) {
    if (c.slug === q || c.name.toLowerCase() === q || c.shortName.toLowerCase() === q) return c.slug;
    if (c.aliases.some((a) => q.includes(a) || a.includes(q))) return c.slug;
  }
  return null;
}

/** Human label for a slug ("city-of-hope" -> "City of Hope"). */
export function locationLabel(slug: string): string {
  return centerBySlug(slug)?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
