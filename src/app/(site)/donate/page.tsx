import type { Metadata } from 'next';
import Link from 'next/link';
import { DonorMessageForm } from '@/components/forms/DonorMessageForm';
import { Callout, PageHeader, PageShell, Prose, Section } from '@/components/site/Prose';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'What donations to TrialTree pay for — site upkeep, educational materials, printed trial diagrams for oncology practices, and outreach to Southern California clinics.',
};

// ---------------------------------------------------------------------------
// Payment integration point.
//
// No processor is configured, so this returns `{ enabled: false }` and the page
// renders an honest "not yet available" state. When a provider is chosen, this
// is the only function that has to change: return its hosted-checkout URL and
// the giving levels below become live. Nothing else on the page assumes
// anything about the provider.
// ---------------------------------------------------------------------------

type OnlineGivingStatus = { enabled: false } | { enabled: true; checkoutUrl: string };

function getOnlineGivingStatus(): OnlineGivingStatus {
  return { enabled: false };
}

const USES = [
  {
    title: 'Keeping the site running',
    body: 'Hosting, the database behind the live boards, domain and security upkeep, and the work of keeping listings current as studies open and close.',
    icon: 'M4 7h16M4 12h16M4 17h10',
  },
  {
    title: 'Educational materials',
    body: 'Plain-language explanations of what a clinical trial is, what phases mean, and what to ask an oncology team — written for patients and families rather than for researchers.',
    icon: 'M4 5h16v12H4zM8 9h8M8 13h5',
  },
  {
    title: 'Printed trial posters and diagrams',
    body: 'Printed decision-tree diagrams and trial posters for oncology practices and waiting rooms, so the map is in front of patients who are not going to visit a website.',
    icon: 'M6 3h12v18l-6-4-6 4z',
  },
  {
    title: 'Outreach to clinics and physicians',
    body: 'Reaching community oncology practices and referring physicians across Southern California so more sites keep their listings current here.',
    icon: 'M12 3a9 9 0 1 0 9 9M12 3v9l6 3M3 12h4',
  },
];

// Amounts only. Nothing has been costed, so saying what a given amount "covers"
// would be an invented figure on a donation page — the uses are described once,
// above, without prices attached.
const GIVING_LEVELS = ['$100', '$250', '$500', '$1,000'];

export default function DonatePage() {
  const onlineGiving = getOnlineGivingStatus();

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Support TrialTree"
        title="Donate"
        lead="TrialTree is free to use and carries no advertising. Donations pay for the things that keep the map current and get it in front of the people who need it."
      />

      <Section title="What donations pay for">
        <div className="grid gap-4 sm:grid-cols-2">
          {USES.map((use) => (
            <div key={use.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <span className="inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600 ring-1 ring-blue-200">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={use.icon} />
                </svg>
              </span>
              <h3 className="mt-3 font-display text-base font-bold text-slate-900">{use.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{use.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Suggested giving levels">
        <Prose>
          <p>
            These are suggestions, not tiers, and there is no minimum. Any amount is welcome, and a
            gift of any size can be given at whatever interval suits you.
          </p>
        </Prose>

        <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {GIVING_LEVELS.map((amount) => (
            <li
              key={amount}
              className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"
            >
              <span className="block font-display text-2xl font-extrabold tracking-tight text-slate-900">
                {amount}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          What a particular amount funds has not been costed yet; every gift goes to the work
          described above.
        </p>

        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center">
          <span className="block font-display text-base font-bold text-slate-900">Other amount</span>
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">
            Any amount is welcome — you will be able to enter your own figure at checkout.
          </span>
        </div>

        <div className="mt-6">
          {onlineGiving.enabled ? (
            <a
              href={onlineGiving.checkoutUrl}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              Continue to secure checkout
            </a>
          ) : (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
              <h3 className="font-display text-lg font-bold text-amber-900">
                Online giving is not enabled yet
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                No payment processor is connected to this site, so there is nothing here that can
                take a card — and we would rather say that plainly than show a button that fails.
                The amounts above are what we will suggest once giving opens.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                If you would like to give before then, or to talk about supporting the printed
                materials directly, please use the{' '}
                <Link
                  href="/suggestions"
                  className="font-semibold underline underline-offset-2 hover:text-amber-950"
                >
                  suggestions form
                </Link>{' '}
                and we will get back to you.
              </p>
              <p className="mt-3">
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-[44px] cursor-not-allowed items-center rounded-lg border border-amber-300 bg-white/70 px-5 text-sm font-semibold text-amber-800 opacity-80"
                >
                  Give online — not yet available
                </button>
              </p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Tax status">
        <Callout tone="placeholder" title="PLACEHOLDER — requires review before launch">
          <p>
            Nonprofit and 501(c)(3) status, the legal entity that would receive donations, the EIN,
            and whether a gift is tax-deductible are all still to be confirmed. Nothing is stated
            here until it has been verified, and no receipt or deductibility language should be
            written into this page before then.
          </p>
        </Callout>
        <Prose className="mt-4">
          <p>
            Once that is settled, this section will say who the recipient organization is, what a
            donor receives as a record of their gift, and what — if anything — is deductible.
          </p>
        </Prose>
      </Section>

      <Section title="Leave a message of support">
        <Prose>
          <p>
            If you would like to say why this matters to you, we would like to read it. Messages are
            reviewed by a person before any of them appear on the site, and none are published
            automatically.
          </p>
        </Prose>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
          {/* No `endpoint` prop: there is no route for donor messages yet, so
              the form renders in its disabled, clearly-labelled state. */}
          <DonorMessageForm />
        </div>
      </Section>
    </PageShell>
  );
}
