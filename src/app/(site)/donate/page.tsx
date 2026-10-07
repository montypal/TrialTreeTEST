import type { Metadata } from 'next';
import { SITE, mailto } from '@/lib/site';
import { PageHeader, PageShell, Prose, Section } from '@/components/site/Prose';

export const metadata: Metadata = {
  title: 'Donate',
  description:
    'Support TrialTree, the hand-curated map of genitourinary cancer trials in Southern California: why donations matter, what they pay for, and how to give.',
};

// ---------------------------------------------------------------------------
// Ways to give.
//
// Email is the only channel that exists today. Card and PayPal are listed so
// that turning one on later is a data change here (set `available` and give it
// an `href`), but only available channels with a destination are rendered: a
// payment button that goes nowhere would be worse than no button at all.
// ---------------------------------------------------------------------------

type DonationChannelId = 'email' | 'stripe' | 'paypal';

type DonationChannel = {
  id: DonationChannelId;
  label: string;
  /** Null until the channel exists, so nothing can link somewhere it cannot go. */
  href: string | null;
  available: boolean;
};

const DONATION_SUBJECT = 'Donation to TrialTree';

const DONATION_CHANNELS: DonationChannel[] = [
  { id: 'email', label: 'Email us to donate', href: mailto(DONATION_SUBJECT), available: true },
  { id: 'stripe', label: 'Give by card', href: null, available: false },
  { id: 'paypal', label: 'Give with PayPal', href: null, available: false },
];

type LiveChannel = DonationChannel & { href: string };

function isLive(channel: DonationChannel): channel is LiveChannel {
  return channel.available && channel.href !== null;
}

// Only what donations actually pay for today. Nothing here promises a product
// or a printed resource that does not exist yet.
const USES = [
  {
    title: 'Keeping the site running',
    body: 'Hosting, the database behind the trial listings, and domain and security upkeep.',
    icon: 'M4 7h16M4 12h16M4 17h10',
  },
  {
    title: 'Keeping listings current',
    body: 'The hand curation that keeps each listing in step with its center’s own trial list as studies open and close.',
    icon: 'M7 4h7l4 4v12H7zM14 4v4h4M10 13h6M10 16.5h4',
  },
  {
    title: 'Reaching more centers',
    body: 'Outreach to Southern California cancer centers whose trials are not mapped here yet.',
    icon: 'M12 3a9 9 0 1 0 9 9M12 3v9l6 3M3 12h4',
  },
];

export default function DonatePage() {
  const channels = DONATION_CHANNELS.filter(isLive);

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Support TrialTree"
        title="Donate"
        lead="TrialTree is free to use and carries no advertising. Donations pay for the work that keeps it accurate."
      />

      <Section title="Our mission">
        <Prose>
          <p>
            TrialTree brings genitourinary cancer trials from participating Southern California
            cancer centers into one browsable map, so patients, caregivers, and clinicians can see
            what is open without checking each center&rsquo;s website separately.
          </p>
        </Prose>
      </Section>

      <Section title="Why donations matter">
        <Prose>
          <p>
            Every listing is transcribed by hand from a center&rsquo;s own trial list, and studies
            open, close, and change all the time. Keeping the map accurate is ongoing work, not a
            one-time build, and donations are what pay for it.
          </p>
        </Prose>
      </Section>

      <Section title="How donations support TrialTree">
        <ul className="grid gap-4 sm:grid-cols-3">
          {USES.map((use) => (
            <li key={use.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
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
                  focusable="false"
                >
                  <path d={use.icon} />
                </svg>
              </span>
              <h3 className="mt-3 font-display text-base font-bold text-slate-900">{use.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{use.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how-to-give" title="How to give">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
          <p className="text-[15px] leading-7 text-slate-600">
            For now, giving starts with an email to the TrialTree board.
          </p>

          {/* The first live channel is the primary action; any later ones sit
              beside it as quieter alternatives. */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {channels.map((channel, index) => (
              <a
                key={channel.id}
                href={channel.href}
                className={
                  index === 0
                    ? 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-base font-semibold text-white shadow-card transition duration-200 hover:bg-blue-700 hover:shadow-lift'
                    : 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-semibold text-slate-700 shadow-sm transition duration-200 hover:border-blue-300 hover:text-blue-700'
                }
              >
                {channel.label}
              </a>
            ))}
          </div>

          {/* Spelled out for anyone whose device has no mail app wired to
              mailto: links. break-all keeps the address from widening the page. */}
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Or write to{' '}
            <a
              href={mailto(DONATION_SUBJECT)}
              className="break-all font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              {SITE.contactEmail}
            </a>{' '}
            with the subject &ldquo;{DONATION_SUBJECT}&rdquo;.
          </p>

          <h3 className="mt-6 font-display text-base font-bold text-slate-900">What happens next</h3>
          <ol className="mt-3 space-y-3">
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
              >
                1
              </span>
              <p className="min-w-0 text-sm leading-relaxed text-slate-600">
                You email us. A line saying you would like to give is enough.
              </p>
            </li>
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
              >
                2
              </span>
              <p className="min-w-0 text-sm leading-relaxed text-slate-600">
                We reply with how to give.
              </p>
            </li>
          </ol>
        </div>

        {/* Two plain statements rather than a placeholder box: what is not
            possible yet, and what a donor should not assume. */}
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
          <li>Online giving by card or PayPal isn&rsquo;t available yet.</li>
          <li>
            Nonprofit status and an EIN will be listed here once they are confirmed. Until then,
            please don&rsquo;t assume a gift to TrialTree is tax-deductible.
          </li>
        </ul>
      </Section>
    </PageShell>
  );
}
