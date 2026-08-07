import Link from 'next/link';
import { CENTERS } from '@/lib/locations';

const FEATURES = [
  {
    title: 'Kept live by text',
    body: 'Clinicians text a change — “close the bladder trial at COH” — and every board updates in seconds.',
    icon: 'M8 10h8M8 14h5M21 12a9 9 0 1 1-3.2-6.9L21 5v4h-4',
    tint: 'from-blue-500/15 to-blue-500/0 text-blue-600 ring-blue-200',
  },
  {
    title: 'AI trial matching',
    body: 'Describe a de-identified scenario and get ranked, reasoned matches across all five centers.',
    icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6z',
    tint: 'from-violet-500/15 to-violet-500/0 text-violet-600 ring-violet-200',
  },
  {
    title: 'Clinic-ready kiosks',
    body: 'Full-screen boards for waiting-room TVs and E-Ink panels, each with a scan-to-update QR code.',
    icon: 'M4 5h16v10H4zM8 19h8M12 15v4',
    tint: 'from-emerald-500/15 to-emerald-500/0 text-emerald-600 ring-emerald-200',
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden text-slate-800">
      <div className="aurora">
        <div className="aurora-3" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-16 sm:py-20">
        {/* Hero */}
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · Southern California
          </div>

          <div className="mt-5 flex items-center gap-3">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-blue-600 drop-shadow-sm" aria-hidden>
              <path d="M12 4v4M12 8l-6 5M12 8l6 5M6 13v3M18 13v3" />
              <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
              <circle cx="6" cy="13" r="1.7" fill="currentColor" stroke="none" />
              <circle cx="18" cy="13" r="1.7" fill="currentColor" stroke="none" />
              <circle cx="6" cy="17.5" r="1.5" fill="#10b981" stroke="none" />
              <circle cx="18" cy="17.5" r="1.5" fill="#10b981" stroke="none" />
            </svg>
            <h1 className="font-display text-5xl font-extrabold tracking-tight text-gradient sm:text-6xl">
              TrialTree
            </h1>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            GU Oncology Trial Map
          </div>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            A living map of recruiting genitourinary cancer trials across{' '}
            <span className="font-semibold text-slate-800">City of Hope, UCLA, UCSD, UCI, and USC</span> —
            searchable, kept current by text message, and displayed on clinic screens.
          </p>
        </div>

        {/* Primary CTAs */}
        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          <Link
            href="/find"
            className="group relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lift"
          >
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-700">
              <span className="text-lg">✨</span> Find a trial
            </div>
            <div className="mt-2 text-slate-600">
              Describe a de-identified patient scenario and get ranked matches in seconds.
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700">
              Open the AI finder
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </div>
          </Link>

          <Link
            href="/admin"
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lift"
          >
            <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Browse the tree</div>
            <div className="mt-2 text-slate-600">
              Pan, zoom, search, and filter every trial by disease, hospital, or investigator.
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              Open the interactive map
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </div>
          </Link>
        </div>

        {/* Feature strip */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className={`inline-flex rounded-xl bg-gradient-to-br p-2.5 ring-1 ${f.tint}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={f.icon} />
                </svg>
              </div>
              <div className="mt-3 font-display font-bold text-slate-900">{f.title}</div>
              <div className="mt-1 text-sm leading-relaxed text-slate-500">{f.body}</div>
            </div>
          ))}
        </div>

        {/* Kiosks */}
        <section className="mt-14">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Clinic kiosk displays
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CENTERS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/kiosk/${c.slug}`}
                  className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-card"
                >
                  <span>
                    <span className="block font-semibold text-slate-800">{c.name}</span>
                    <span className="text-xs text-slate-400">/kiosk/{c.slug}</span>
                  </span>
                  <span className="text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-blue-500">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-14 text-xs text-slate-400">
          Decision support only — confirm eligibility against the full protocol and the study team.
        </p>
      </div>
    </main>
  );
}
