import type { Metadata } from 'next';
import Link from 'next/link';
import { CENTERS } from '@/lib/locations';
import { mappedCenterSlugs } from '@/lib/tree/curatedStats';
import { CANCERS, CHIP, DOT } from '@/lib/cancerColors';
import { SITE, mailto } from '@/lib/site';
import { Callout, PageHeader, PageShell, Prose, Section } from '@/components/site/Prose';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why TrialTree exists, how its genitourinary cancer trial listings are put together from participating Southern California institutions, and who is behind it.',
};

// ---------------------------------------------------------------------------
// Founders are names only, read from SITE.founders. No role, degree, bio or
// affiliation is shown for anyone until they have confirmed it themselves —
// on a clinical site an invented credential is worse than a short card.
// ---------------------------------------------------------------------------

function initialsFor(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function AboutPage() {
  const mappedCenters = mappedCenterSlugs();
  // Read once into a local so the null check narrows it for the JSX below.
  const instagram = SITE.instagram;

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="About"
        title="A clearer map of GU cancer trials in Southern California"
        lead="TrialTree brings genitourinary cancer trials from participating Southern California cancer centers into one browsable map, so patients, caregivers, and clinicians can see what is open without checking each center's website separately."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {CANCERS.map((cancer) => (
          <span
            key={cancer.label}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${CHIP[cancer.hue]}`}
          >
            <span className={`h-2 w-2 rounded-full ${DOT[cancer.hue]}`} aria-hidden />
            {cancer.short} cancer
          </span>
        ))}
      </div>

      <Section title="Mission">
        <Prose>
          <p>
            TrialTree exists to make genitourinary cancer trials in Southern California easier to
            find and easier to understand. The same information that is scattered across
            institutional pages, registry records, and printed handouts is organized here as a
            single decision tree: start from a cancer, follow the disease state, the biomarker, and
            the line of therapy, and see which studies sit at the end of that path.
          </p>
          <p>
            The audience is deliberately mixed. A patient or family member should be able to arrive
            with a diagnosis and leave with a short list of questions for their oncologist. A
            clinician should be able to scan the same map in the middle of a clinic day.
          </p>
        </Prose>
      </Section>

      <Section title="The problem">
        <Prose>
          <p>
            Trial information is fragmented. Each cancer center publishes its own list in its own
            format; public registries hold the formal protocol record but are written for
            researchers and regulators rather than for the person sitting in the waiting room.
          </p>
          <p>
            The practical result is that a patient in Los Angeles or San Diego can be within driving
            distance of a relevant study and never hear about it, and a referring physician can
            spend an afternoon on the phone establishing what is open where.
          </p>
        </Prose>
      </Section>

      <Section title="How these listings are put together">
        <Prose>
          <p>
            <strong>
              TrialTree gathers trial information directly from participating Southern California
              institutions
            </strong>{' '}
            — from the lists their study teams keep and from what clinicians at those sites tell us
            — rather than relying solely on ClinicalTrials.gov. The intent is that a listing
            reflects what a site describes itself as enrolling, including studies that are open
            locally but hard to pick out of a national registry search.
          </p>
          <p>
            Every entry is curated by hand, and NCT numbers are matched to each study&rsquo;s
            record on ClinicalTrials.gov. Until a listing&rsquo;s NCT number has been confirmed, it
            reads &ldquo;NCT number pending verification&rdquo; rather than showing a number we are
            not sure of.
          </p>
          <p>
            This is a description of method, not a guarantee. Curated information can still be
            incomplete or out of date, and TrialTree does not verify eligibility for any individual.
            Always confirm what you read here against the full protocol and with the study team.
          </p>
        </Prose>
      </Section>

      <Section title="What TrialTree is not">
        <Callout tone="warning" title="Informational and decision support only">
          <p>
            TrialTree does not give medical advice, does not determine whether anyone is eligible
            for a study, and does not enroll anyone in a trial. It does not replace a conversation
            with an oncologist or a study team, and using this site does not create a doctor–patient
            relationship.
          </p>
        </Callout>
        <Prose className="mt-4">
          <p>
            There are also no user accounts, and nothing on this site is designed to hold a patient
            record.
          </p>
        </Prose>
      </Section>

      <Section title="Coverage">
        <Prose>
          <p>
            TrialTree covers prostate, bladder, kidney (renal cell) and other genitourinary cancer
            trials at Southern California centers. A center is marked as mapped once its own trial
            list has been curated; the others are centers TrialTree tracks that have no trials on
            this site attributed to them yet.
          </p>
        </Prose>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CENTERS.map((center) => {
            const mapped = mappedCenters.has(center.slug);
            return (
              <li
                key={center.slug}
                className={
                  mapped
                    ? 'flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm'
                    : 'flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600'
                }
              >
                <span className="min-w-0 break-words">{center.name}</span>
                {/* The state is in words, not only in the border style. */}
                <span className={mapped ? 'shrink-0 text-xs font-medium text-emerald-700' : 'shrink-0 text-xs font-medium text-slate-500'}>
                  {mapped ? 'Mapped' : 'Not yet mapped'}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Founders">
        <ul className="grid gap-3 sm:grid-cols-2">
          {SITE.founders.map((name) => (
            <li
              key={name}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
            >
              {/* Initials rather than a photograph — we have no image, and a
                  stock portrait on a founder card would be a fabrication. */}
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 font-display text-sm font-bold text-slate-500"
              >
                {initialsFor(name)}
              </span>
              <h3 className="min-w-0 break-words font-display text-base font-bold tracking-tight text-slate-900">
                {name}
              </h3>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Working with us">
        <Prose>
          <p>
            If you are a physician, coordinator, or research office at a Southern California center,
            you can send a study for verification through the{' '}
            <Link href="/submit">trial submission form</Link>. If you have spotted something missing
            or wrong on a listing, the lighter-weight{' '}
            <Link href="/suggestions">suggestions form</Link> is the faster route. Support for the
            site&rsquo;s upkeep goes through <Link href="/donate">donations</Link>.
          </p>
        </Prose>
      </Section>

      <Section id="contact" title="Contact">
        <Prose>
          <p>
            Email us at{' '}
            {/* break-all: one unbreakable word that must wrap, not overflow, on
                a narrow phone. */}
            <a href={mailto()} className="break-all">
              {SITE.contactEmail}
            </a>
            .
          </p>
          {instagram ? (
            <p>
              Follow us on Instagram:{' '}
              <a href={instagram.url} target="_blank" rel="noreferrer">
                {instagram.handle}
              </a>
            </p>
          ) : null}
        </Prose>
      </Section>
    </PageShell>
  );
}
