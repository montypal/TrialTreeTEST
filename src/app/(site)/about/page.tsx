import type { Metadata } from 'next';
import Link from 'next/link';
import { CENTERS } from '@/lib/locations';
import { mappedCenterSlugs } from '@/lib/tree/curatedStats';
import { CANCERS, CHIP, DOT } from '@/lib/cancerColors';
import { Callout, PageHeader, PageShell, Pending, Prose, Section } from '@/components/site/Prose';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why TrialTree exists, how its genitourinary cancer trial listings are put together from participating Southern California institutions, and who is behind it.',
};

// ---------------------------------------------------------------------------
// Founder profiles.
//
// The component is data-driven with one slot per kind of fact, because we have
// none of those facts verified yet: every slot renders an explicit "to be
// provided" marker rather than a guess. Filling this page in later is a matter
// of replacing nulls in FOUNDERS — no markup changes.
//
// It lives in this file, unexported, because Next rejects any export from a
// page.tsx that is not a route field ("is not a valid Page export field"). Lift
// it into src/components/site/ the moment a second page needs it.
// ---------------------------------------------------------------------------

type FounderProfileData = {
  name: string;
  /** Role/title at TrialTree. Null until confirmed. */
  role: string | null;
  bio: string | null;
  education: string[] | null;
  researchInterests: string[] | null;
  publications: string[] | null;
};

const FOUNDERS: FounderProfileData[] = [
  {
    name: 'Charlotte Moore',
    role: null,
    bio: null,
    education: null,
    researchInterests: null,
    publications: null,
  },
  {
    name: 'Aarav Pal',
    role: null,
    bio: null,
    education: null,
    researchInterests: null,
    publications: null,
  },
];

function initialsFor(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function ProfileSlot({ heading, items }: { heading: string; items: string[] | null }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</h4>
      {items && items.length > 0 ? (
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <div className="mt-1.5">
          <Pending />
        </div>
      )}
    </div>
  );
}

function FounderProfile({ founder }: { founder: FounderProfileData }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        {/* Initials rather than a photograph — we have no image, and a stock
            portrait on a founder card would be a fabrication. */}
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 font-display text-base font-bold text-slate-500"
        >
          {initialsFor(founder.name)}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold tracking-tight text-slate-900">
            {founder.name}
          </h3>
          {founder.role ? (
            <p className="text-sm font-medium text-slate-500">{founder.role}</p>
          ) : (
            <div className="mt-1">
              <Pending label="Role — to be provided" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Biography</h4>
        {founder.bio ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{founder.bio}</p>
        ) : (
          <div className="mt-1.5">
            <Pending />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <ProfileSlot heading="Education" items={founder.education} />
        <ProfileSlot heading="Research interests" items={founder.researchInterests} />
        <ProfileSlot heading="Publications" items={founder.publications} />
      </div>
    </article>
  );
}

export default function AboutPage() {
  const mappedCenters = mappedCenterSlugs();
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
            Every entry is curated by hand. Clinicians at participating sites can send a change by
            text message, and the boards in this site update from that same curated record, so a
            closure or a reopening can be reflected here as soon as it is confirmed.
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
            There are also no user accounts. The trial finder asks you to describe a clinical
            situation without identifiers — no names, dates of birth, medical record numbers, or
            addresses — and nothing on this site is designed to hold a patient record.
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
        <Prose>
          <p>
            TrialTree is built and maintained by the people below. Their profiles are intentionally
            incomplete: nothing is published here until it has been confirmed by the person it
            describes.
          </p>
        </Prose>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {FOUNDERS.map((founder) => (
            <FounderProfile key={founder.name} founder={founder} />
          ))}
        </div>
        <div className="mt-4">
          <Callout tone="placeholder" title="PLACEHOLDER — requires review before launch">
            <p>
              Biographies, education, research interests, and publications for both founders are
              awaiting confirmed copy. No credential, degree, affiliation, title, or publication has
              been written in on their behalf.
            </p>
          </Callout>
        </div>
      </Section>

      <Section title="Working with us">
        <Prose>
          <p>
            If you are a physician, coordinator, or research office at a Southern California center,
            you can send a study for verification through the{' '}
            <Link href="/submit">trial submission form</Link>. If you have spotted something missing
            or wrong on a listing, the lighter-weight{' '}
            <Link href="/suggestions">suggestions form</Link> is the faster route. Support for the
            site&rsquo;s upkeep and printed materials goes through{' '}
            <Link href="/donate">donations</Link>.
          </p>
        </Prose>
      </Section>
    </PageShell>
  );
}
