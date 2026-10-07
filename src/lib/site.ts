// ---------------------------------------------------------------------------
// Facts about TrialTree itself, in one place, so the header, footer, About
// and Donate pages can never disagree with each other.
//
// Only confirmed facts go in here. Anything not yet confirmed is null, and
// every page that reads it renders nothing for a null rather than a
// placeholder: an invented handle, title or credential on a clinical site is
// worse than a gap.
// ---------------------------------------------------------------------------

export type SocialAccount = { handle: string; url: string };

export const SITE = {
  name: 'TrialTree',
  /** The board's inbox: general contact and, for now, donations. */
  contactEmail: 'TrialTreeBoard@gmail.com',
  /**
   * Not yet confirmed. Set to e.g. { handle: '@name', url: 'https://www.instagram.com/name/' }
   * and the footer and About page show a "Follow us" link; while null they show nothing.
   */
  instagram: null as SocialAccount | null,
  /** Names exactly as given. No titles, degrees or affiliations until confirmed. */
  founders: ['Charlotte Moore', 'Aarav Pal'] as readonly string[],
} as const;

/**
 * Fired by the header logo when it is clicked on "/". The homepage IS the
 * cancer chooser, so a click there from inside a tree is a same-URL navigation
 * that remounts nothing; the chooser listens for this and goes home instead.
 */
export const HOME_EVENT = 'trialtree:home';

export function mailto(subject?: string): string {
  const base = `mailto:${SITE.contactEmail}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
