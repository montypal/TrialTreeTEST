import Link from 'next/link';
import { CARD, hueFor } from '@/lib/cancerColors';
import { OrganIcon } from '@/components/icons/OrganIcon';
import type { OrganIconName } from '@/components/icons/OrganIcon';

// ---------------------------------------------------------------------------
// The four disease doors on the homepage — the primary way into /explore.
//
// Categories are keyed by the curated tree's own root label so the hue comes
// from hueFor() and the count can be matched up without a second naming
// scheme. Each card links to /explore with the disease preselected; if the
// explore view ignores the query it still lands on the right page.
//
// Server component on purpose: hover and focus are pure CSS, so nothing here
// needs to ship to the browser.
// ---------------------------------------------------------------------------

type Category = {
  /** Must match the DISEASE_TYPE root label in curatedData. */
  rootLabel: string;
  title: string;
  blurb: string;
  icon: OrganIconName;
};

const CATEGORIES: Category[] = [
  {
    rootLabel: 'Prostate Cancer',
    title: 'Prostate cancer',
    blurb: 'Localized, biochemical recurrence, mHSPC and mCRPC.',
    icon: 'prostate',
  },
  {
    rootLabel: 'Bladder Cancer',
    title: 'Bladder cancer',
    blurb: 'NMIBC, muscle-invasive, upper tract and metastatic.',
    icon: 'bladder',
  },
  {
    rootLabel: 'Renal Cell Carcinoma',
    title: 'Kidney cancer',
    blurb: 'Renal cell carcinoma by stage, histology and line of therapy.',
    icon: 'kidney',
  },
  {
    rootLabel: 'Other GU Trials',
    title: 'Other GU',
    blurb: 'Germ cell tumors, registries and cross-disease studies.',
    icon: 'other',
  },
];

type CategoryGridProps = {
  /**
   * Curated-trial counts keyed by root label. A category with no entry simply
   * shows no count — an invented number on a trial finder is worse than none.
   */
  counts?: Record<string, number>;
};

export function CategoryGrid({ counts }: CategoryGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {CATEGORIES.map((c) => {
        const hue = hueFor(c.rootLabel);
        const count = counts?.[c.rootLabel];
        const countLabel = count === undefined ? null : `${count} ${count === 1 ? 'trial' : 'trials'}`;

        return (
          // The <li> is the flex container so every card stretches to the
          // tallest in its row — blurbs are different lengths.
          <li key={c.rootLabel} className="flex">
            <Link
              href={`/explore?disease=${encodeURIComponent(c.rootLabel)}`}
              className={`group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-b ${CARD[hue].grad} p-4 text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-y-0.5 ${CARD[hue].hover} sm:flex-col sm:items-start sm:gap-0 sm:p-5`}
            >
              <OrganIcon name={c.icon} hue={hue} className="h-12 w-12 shrink-0" />

              <span className="min-w-0 flex-1 sm:mt-4 sm:w-full">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-display text-base font-bold tracking-tight text-slate-900">
                    {c.title}
                  </span>
                  {countLabel && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CARD[hue].badge}`}
                    >
                      {countLabel}
                      <span className="sr-only"> tracked</span>
                    </span>
                  )}
                </span>

                <span className="mt-1.5 block text-sm leading-snug text-slate-500">{c.blurb}</span>

                <span className="mt-3 hidden items-center gap-1 text-sm font-semibold text-slate-700 sm:inline-flex">
                  Explore
                  <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </span>

              {/* Phone layout puts the affordance on the right edge instead. */}
              <span
                aria-hidden
                className="shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500 sm:hidden"
              >
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
