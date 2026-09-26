import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { CENTERS } from '@/lib/locations';
import { CURATED_TREES } from '@/lib/tree/curatedData';
import { countTrials, mappedCenterSlugs } from '@/lib/tree/curatedStats';

export const metadata: Metadata = {
  title: { absolute: 'TrialTree — GU cancer clinical trials in Southern California' },
  description:
    'Browse prostate, bladder, kidney and other genitourinary cancer clinical trials at Southern California centers as a decision tree, or describe a scenario and let the finder rank the matches.',
};

// ---------------------------------------------------------------------------
// Homepage. Lives in the (site) group so it inherits the site header and
// footer — it deliberately renders neither, and no <main>, because the group
// layout owns both landmarks.
//
// Every number on this page is counted from curatedData at render time rather
// than typed into the copy. A stale hand-written figure on a trial finder is a
// clinical problem, not a copy problem, so the page counts or says nothing.
// ---------------------------------------------------------------------------

// "How TrialTree stays current" — each claim maps to something that actually
// ships: curatedData.ts, the SMS/email webhooks behind the confidence gate,
// and the /kiosk routes. Nothing aspirational goes in this list.
const CAPABILITIES = [
  {
    title: 'Curated by hand',
    body: 'Every study in the tree is transcribed by hand from the treating center’s own trial list — the tree is not generated from a registry search.',
    icon: 'M7 4h7l4 4v12H7zM14 4v4h4M10 13h6M10 16.5h4',
    tint: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  {
    title: 'Kept current by text',
    body: 'Clinicians at participating sites can text or email a change. Clear updates reach every board in seconds; anything ambiguous waits for a human to approve it.',
    icon: 'M8 10h8M8 14h5M21 12a9 9 0 1 1-3.2-6.9L21 5v4h-4',
    tint: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  {
    title: 'Built for the clinic',
    body: 'Full-screen boards for waiting-room screens and E-Ink panels, each with a scan-to-update QR code in the corner.',
    icon: 'M4 5h16v10H4zM8 19h8M12 15v4',
    tint: 'bg-orange-50 text-orange-700 ring-orange-200',
  },
];

export default function HomePage() {
  const counts: Record<string, number> = {};
  let totalTrials = 0;
  for (const root of CURATED_TREES) {
    const n = countTrials(root);
    counts[root.label] = n;
    totalTrials += n;
  }

  const mappedCenters = mappedCenterSlugs();

  return (
    // Horizontal padding never drops below px-6 (1.5rem) but grows to clear the
    // notch on a landscape iPhone (viewportFit: cover). The group <main> caps
    // the width but supplies no gutter, so the gutter lives here.
    <div className="mx-auto max-w-5xl px-6 pb-16 pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] pt-8 sm:pt-10">
      {/* ── Hero: what this is, what you can do, where it covers ──────────
          The aurora is scoped to this rounded panel rather than the page. The
          group layout caps content at max-w-6xl, so a page-wide backdrop would
          get hard-clipped mid-screen on a desktop; inside a rounded card the
          same blobs read as intentional. */}
      <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-5 shadow-card sm:p-8 lg:p-10">
        <div className="aurora">
          <div className="aurora-3" />
        </div>

        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur">
            {/* The pulsing dot is decorative; the word "Live" carries it. */}
            <span aria-hidden className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · Southern California
          </p>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
            TrialTree · GU oncology trial map
          </p>

          <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Discover genitourinary cancer clinical trials across{' '}
            <span className="text-blue-700">Southern California</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            TrialTree organizes the prostate, bladder, kidney and other GU studies we track into one
            browsable decision tree — disease state, biomarker, line of therapy — so you can see
            what is open, at which center, and who is running it. Search it yourself, or describe a
            de-identified scenario and let the finder rank the possibilities for you to verify.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/explore"
              className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-card transition duration-200 hover:bg-blue-700 hover:shadow-lift"
            >
              Explore the trial tree
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="/find"
              className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:border-blue-300 hover:text-blue-700 hover:shadow-card"
            >
              Find a trial
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── The four doors into /explore — the point of the page ─────────── */}
      <section className="mt-12 sm:mt-14">
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Start with a disease area
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Open a cancer to walk its decision tree — stage, histology, biomarker and line of therapy
          — with the trials that sit at each branch.
        </p>
        <div className="mt-5">
          <CategoryGrid counts={counts} />
        </div>
      </section>

      {/* ── Coverage: which SoCal centers are actually in the catalog ────── */}
      <section className="mt-12 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-card sm:mt-14 sm:p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
          Southern California coverage
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          {totalTrials} trials from {mappedCenters.size} centers are in the curated catalog today, each one
          transcribed by hand from that center’s own published trial list. Centers shown below as
          not yet mapped have no trials on this site attributed to them.
        </p>

        <ul className="mt-4 flex flex-wrap gap-2">
          {CENTERS.map((c) => {
            const isMapped = mappedCenters.has(c.slug);
            return (
              <li key={c.slug}>
                {/* Dashed outline plus the words "not yet mapped" — the state is
                    never carried by styling alone. */}
                <span
                  className={
                    isMapped
                      ? 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700'
                      : 'inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500'
                  }
                >
                  {c.name}
                  {!isMapped && <span className="text-xs">· not yet mapped</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── How it stays current ─────────────────────────────────────────── */}
      <section className="mt-12 sm:mt-14">
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          How TrialTree stays current
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {CAPABILITIES.map((f) => (
            <li
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-card"
            >
              <span className={`inline-flex rounded-xl p-2.5 ring-1 ${f.tint}`}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  focusable="false"
                >
                  <path d={f.icon} />
                </svg>
              </span>
              <h3 className="mt-3 font-display font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Clinic kiosks ────────────────────────────────────────────────── */}
      <section className="mt-12 sm:mt-14">
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Clinic kiosk displays
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Full-screen boards built for waiting-room screens. Open one on any display and leave it
          running.
        </p>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CENTERS.map((c) => (
            <li key={c.slug} className="flex">
              <Link
                href={`/kiosk/${c.slug}`}
                className="group flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-card"
              >
                {/* min-w-0 + break-words: long names wrap inside the card on a
                    phone instead of overflowing it. */}
                <span className="min-w-0 break-words">
                  <span className="block font-semibold text-slate-800">{c.name}</span>
                  <span className="text-xs text-slate-500">/kiosk/{c.slug}</span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── The honest bit. Kept from the original page, and kept visible. */}
      <p className="mt-12 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm leading-relaxed text-slate-600 sm:mt-14">
        <strong className="font-semibold text-slate-800">Decision support only.</strong> TrialTree
        does not provide medical advice and does not enroll patients. Confirm eligibility and
        current recruitment status against the full protocol and the study team before acting on
        anything you see here.
      </p>
    </div>
  );
}
