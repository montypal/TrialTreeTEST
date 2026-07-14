import Link from 'next/link';
import { CENTERS } from '@/lib/locations';

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-blue-400" aria-hidden>
          <path d="M12 4v4M12 8l-6 5M12 8l6 5M6 13v3M18 13v3" />
          <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
          <circle cx="6" cy="13" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="18" cy="13" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="6" cy="17.5" r="1.5" fill="#34d399" stroke="none" />
          <circle cx="18" cy="17.5" r="1.5" fill="#34d399" stroke="none" />
        </svg>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-50">TrialTree</h1>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            GU Oncology Trial Map · Southern California
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
        A live map of recruiting genitourinary cancer trials across City of Hope, UCLA, UCSD, UCI, and
        USC — searchable, kept current by text message, and displayed on clinic screens.
      </p>

      {/* Primary CTAs */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/find"
          className="group rounded-2xl border border-blue-500/40 bg-blue-500/10 p-5 transition hover:border-blue-400/70 hover:bg-blue-500/15"
        >
          <div className="text-sm font-bold uppercase tracking-wider text-blue-300">✨ Find a trial</div>
          <div className="mt-1 text-slate-200">
            Describe a de-identified patient scenario and get ranked matches in seconds.
          </div>
          <div className="mt-3 text-sm font-semibold text-blue-300 group-hover:underline">
            Open the AI finder →
          </div>
        </Link>

        <Link
          href="/admin"
          className="group rounded-2xl border border-slate-700 bg-slate-900/60 p-5 transition hover:border-slate-500"
        >
          <div className="text-sm font-bold uppercase tracking-wider text-slate-400">Browse the tree</div>
          <div className="mt-1 text-slate-200">
            Pan, zoom, search, and filter every trial by disease, hospital, or PI.
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-300 group-hover:underline">
            Open the interactive map →
          </div>
        </Link>
      </div>

      {/* Kiosks */}
      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Clinic kiosk displays
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CENTERS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/kiosk/${c.slug}`}
                className="block rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 transition hover:border-slate-600"
              >
                <span className="block font-semibold text-slate-200">{c.name}</span>
                <span className="text-xs text-slate-500">/kiosk/{c.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-xs text-slate-600">
        Decision support only — confirm eligibility against the full protocol and the study team.
      </p>
    </main>
  );
}
