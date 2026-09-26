import Link from 'next/link';
import { RIBBON_STRIPE } from '@/lib/cancerColors';

// ---------------------------------------------------------------------------
// Site-wide footer. Deliberately free of hooks and browser APIs so it can be
// dropped into a server component (the (site) layout) or a client shell (the
// full-screen routes) without a 'use client' boundary either way.
//
// The organizational identity block is a visible placeholder on purpose: legal
// entity name, nonprofit status and EIN are not confirmed, and a footer is
// exactly the place where a plausible-looking guess would be read as fact.
// ---------------------------------------------------------------------------

type FooterGroup = { heading: string; links: { href: string; label: string }[] };

const GROUPS: FooterGroup[] = [
  {
    heading: 'Trials',
    links: [
      { href: '/explore', label: 'Explore Trials' },
      { href: '/find', label: 'Find a Trial' },
    ],
  },
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

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className={`h-[3px] ${RIBBON_STRIPE}`} aria-hidden />

      <div className="mx-auto max-w-6xl px-5 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="font-display text-base font-extrabold tracking-tight text-slate-900">
              TrialTree
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
              <ul className="mt-3 space-y-1">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {/* Negative margins cancel the padding, so the tap target
                        is comfortable without opening up the list spacing. */}
                    <Link
                      href={link.href}
                      className="-mx-2 inline-flex min-h-[40px] items-center rounded-md px-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Scope — what this site does and does not cover. */}
        <div className="mt-10 border-t border-slate-200 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Southern California scope
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Coverage is limited to genitourinary oncology trials — prostate, bladder, kidney and
            other GU — at Southern California centers. Which centers have trials mapped today is
            listed on the{' '}
            <Link href="/about" className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800">
              About page
            </Link>
            . Trials outside Southern California, and outside genitourinary oncology, are out of
            scope — search{' '}
            <a
              href="https://clinicaltrials.gov"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              ClinicalTrials.gov
            </a>{' '}
            for those.
          </p>
        </div>

        {/* Medical disclaimer. Plain language, and repeated on every page
            because it is the one thing a visitor must not miss. */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900">Informational use only</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-900">
            TrialTree is an informational and decision-support resource. It is{' '}
            <strong className="font-semibold">not medical advice</strong>, not an eligibility
            determination, and using it does not create a doctor–patient relationship. Confirm
            eligibility against the full protocol and with the study team before making any
            treatment decision.
          </p>
        </div>

        {/* Organizational identity — unverified, so it stays an obvious blank. */}
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            PLACEHOLDER — requires review before launch
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            <li>Legal entity name: not yet confirmed</li>
            <li>Nonprofit / 501(c)(3) status: not yet confirmed</li>
            <li>EIN: not yet confirmed</li>
            <li>Contact email and mailing address: not yet provided</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>TrialTree · Southern California genitourinary oncology</p>
          <Link
            href="/terms"
            className="-mx-2 inline-flex min-h-[40px] items-center rounded-md px-2 font-semibold text-slate-500 underline underline-offset-2 hover:text-blue-700 sm:min-h-0"
          >
            Terms of Use (draft)
          </Link>
        </div>
      </div>
    </footer>
  );
}
