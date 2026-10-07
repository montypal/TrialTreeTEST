import Link from 'next/link';
import { RIBBON_STRIPE } from '@/lib/cancerColors';
import { SITE, mailto } from '@/lib/site';

// ---------------------------------------------------------------------------
// Site-wide footer. Deliberately free of hooks and browser APIs so it can be
// dropped into a server component (the (site) layout) or a client shell (the
// full-screen routes) without a 'use client' boundary either way.
//
// Everything it says about TrialTree itself comes from SITE, so the footer,
// About and Donate pages cannot drift apart. Unconfirmed facts are null there
// and render as nothing here — no placeholder rows, no guessed handle.
// ---------------------------------------------------------------------------

type FooterGroup = { heading: string; links: { href: string; label: string }[] };

const GROUPS: FooterGroup[] = [
  {
    heading: 'Contribute',
    links: [
      { href: '/submit', label: 'Trial Submission' },
      { href: '/suggestions', label: 'Suggestions' },
      { href: '/donate', label: 'Donate' },
    ],
  },
  {
    heading: 'Organization',
    links: [
      { href: '/about', label: 'About' },
      { href: '/terms', label: 'Terms of Use' },
    ],
  },
];

// Negative margins cancel the padding, so each link gets a 44px tap target
// without opening up the list spacing.
const FOOTER_LINK =
  '-mx-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700';

export function SiteFooter() {
  // Read once into a local so the null check narrows it for the JSX below.
  const instagram = SITE.instagram;

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className={`h-[3px] ${RIBBON_STRIPE}`} aria-hidden />

      <div className="mx-auto max-w-6xl px-5 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="font-display text-base font-extrabold tracking-tight text-slate-900">
              {SITE.name}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              A curated map of genitourinary cancer trials — prostate, bladder, and kidney — at
              participating cancer centers across Southern California.
            </p>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {group.heading}
              </h2>
              <ul className="mt-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contact
            </h2>
            <ul className="mt-3">
              <li>
                {/* break-all: the address is one unbreakable word, and on a
                    narrow phone it must wrap rather than push the page sideways. */}
                <a href={mailto()} className={`${FOOTER_LINK} break-all`}>
                  {SITE.contactEmail}
                </a>
              </li>
              {instagram ? (
                <li>
                  <a
                    href={instagram.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`${FOOTER_LINK} gap-2`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      focusable="false"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
                    </svg>
                    Follow us {instagram.handle}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {/* The one sentence a visitor must not miss, kept to a single line's
            worth so it is read rather than scrolled past. */}
        <p className="mt-10 border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-600">
          <strong className="font-semibold text-slate-800">Decision support only.</strong> TrialTree
          is not medical advice and does not determine eligibility. Confirm every trial with the
          study team before acting on it.
        </p>

        <p className="mt-4 text-xs text-slate-500">
          {SITE.name} · Southern California genitourinary oncology
        </p>
      </div>
    </footer>
  );
}
