import Link from 'next/link';
import { CENTERS } from '@/lib/locations';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-extrabold tracking-tight">TrialTree</h1>
      <p className="mt-3 text-lg text-slate-300">
        Real-time GU oncology trial decision map for Southern California. Update by text or email;
        clinic kiosks redraw instantly.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Admin / Desktop
        </h2>
        <Link
          href="/admin"
          className="mt-2 inline-block rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
        >
          Open interactive tree →
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Kiosk displays
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CENTERS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/kiosk/${c.slug}`}
                className="block rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 hover:border-slate-500"
              >
                <span className="block font-semibold">{c.name}</span>
                <span className="text-xs text-slate-400">/kiosk/{c.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
