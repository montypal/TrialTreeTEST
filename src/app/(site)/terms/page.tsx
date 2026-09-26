import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout, PageHeader, PageShell, Prose, Section } from '@/components/site/Prose';

export const metadata: Metadata = {
  title: 'Terms of Use (draft)',
  description:
    'An unreviewed working draft of the TrialTree Terms of Use. Not legal advice, not reviewed by counsel, and not in force.',
};

// ---------------------------------------------------------------------------
// Terms of Use — DRAFT.
//
// Written as a statement of intent for each clause rather than as operative
// legal language, because nobody qualified has reviewed it. Every section
// carries a visible "Draft" stamp for the same reason: a terms page that reads
// as finished is worse than no terms page at all, since a visitor has no way
// to tell the difference.
// ---------------------------------------------------------------------------

export default function TermsPage() {
  return (
    <PageShell>
      {/* Unmissable, above everything, and repeated per section below. */}
      <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">
          Unreviewed draft — not in force
        </p>
        {/* Deliberately not a heading: the banner sits above the page's <h1>, and
            an h2 before the h1 breaks the outline a screen-reader user navigates by. */}
        <p className="mt-2 font-display text-lg font-bold text-amber-900">
          This document has not been reviewed by a lawyer
        </p>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          What follows is a working outline of what the TrialTree Terms of Use are intended to
          cover. It is not legal advice, it has not been reviewed or approved by counsel, it is not
          a binding agreement, and it should not be relied on by anyone. Each section below states
          an intention, not a finished term. The whole document requires legal review before
          launch.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-amber-900">
          <li>Effective date: not set</li>
          <li>Last reviewed by counsel: never</li>
          <li>Governing law and jurisdiction: not determined</li>
          <li>Contracting legal entity: not yet confirmed</li>
        </ul>
      </div>

      <div className="mt-10">
        <PageHeader
          eyebrow="Draft"
          title="Terms of Use"
          lead="The outline below describes what each section of the finished terms is meant to address."
        />
      </div>

      <Section id="scope" title="1. Scope of this service" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> TrialTree is a website that organizes information
            about genitourinary cancer clinical trials — prostate, bladder, and kidney — at
            participating cancer centers in Southern California, and presents it as a browsable
            decision tree along with an assistant that suggests potentially relevant studies. These
            terms would govern use of that website and anything published on it.
          </p>
          <p>
            TrialTree does not conduct clinical trials, does not enroll participants, is not a
            sponsor or an institutional review board, and is not a healthcare provider.
          </p>
        </Prose>
      </Section>

      <Section id="informational" title="2. Informational use only — not medical advice" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> everything on TrialTree is provided for general
            informational and decision-support purposes. It is not medical advice, not a diagnosis,
            not a treatment recommendation, and not a determination that anyone is eligible or
            ineligible for a study. Eligibility is decided by a study team against the full
            protocol, never by this site.
          </p>
          <p>
            Anyone considering a clinical trial should discuss it with their own physician and with
            the study team at the site running it.
          </p>
        </Prose>
      </Section>

      <Section id="relationship" title="3. No doctor–patient relationship" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> using TrialTree, sending a suggestion, submitting a
            trial, or corresponding with anyone associated with the site does not create a
            doctor–patient relationship, a clinician–patient relationship, or any other professional
            relationship of care.
          </p>
        </Prose>
      </Section>

      <Section id="accuracy" title="4. Accuracy, currency, and completeness" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> listings are curated by hand from information provided
            by participating institutions and from public sources, and are provided on an
            &ldquo;as is&rdquo; basis. Trial status, cohorts, sites, and investigators change
            frequently, and a listing may be incomplete, out of date, or in error at any given
            moment. TrialTree does not warrant accuracy, currency, or completeness, and the absence
            of a trial from this site does not mean it does not exist.
          </p>
          <p>
            Anything read here should be confirmed against the full protocol and with the study
            team before it is acted on.
          </p>
        </Prose>
      </Section>

      <Section id="third-party" title="5. Third-party links and sources" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> TrialTree links to and draws on third-party sources,
            including{' '}
            <a href="https://clinicaltrials.gov" target="_blank" rel="noreferrer">
              ClinicalTrials.gov
            </a>{' '}
            and the websites of participating institutions. Those sources are controlled by others.
            TrialTree does not endorse them, is not responsible for their content or availability,
            and following a link means leaving this site and entering one governed by its own terms
            and privacy practices.
          </p>
        </Prose>
      </Section>

      <Section id="submitted-information" title="6. Information you submit" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> the trial submission form, the suggestions form, and
            the trial finder are not designed to receive protected health information, and visitors
            are asked not to send it. Submissions are reviewed by people before anything is
            published; a submission does not publish a trial, and a message of support is not
            published automatically.
          </p>
          <p>
            <strong>This section is incomplete.</strong> How submitted information is stored, how
            long it is kept, who can see it, and what happens on request for deletion all need to be
            written down and reviewed — and a separate privacy policy is likely required. None of
            that exists yet.
          </p>
        </Prose>
      </Section>

      <Section id="intellectual-property" title="7. Intellectual property" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> the TrialTree name, the site design, the decision-tree
            structure, and the original text on this site belong to the operator of TrialTree.
            Underlying trial facts drawn from public registries and from institutional sources are
            not claimed as proprietary, and the intended terms of reuse for the curated
            presentation — including whether the printed diagrams may be redistributed by clinics —
            still have to be decided.
          </p>
        </Prose>
      </Section>

      <Section id="liability" title="8. Limitation of liability" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> this section will set out the limits of TrialTree&rsquo;s
            liability for decisions made in reliance on the site. The substance, scope, and
            enforceability of such a clause depend on the legal entity, the governing law, and
            advice from counsel — none of which have been settled — so no wording is proposed here.
          </p>
        </Prose>
        <div className="mt-4">
          <Callout tone="placeholder" title="PLACEHOLDER — requires legal review before launch">
            <p>
              Deliberately left blank. A limitation-of-liability clause drafted without counsel is
              of no use and risks misleading readers into thinking it is binding.
            </p>
          </Callout>
        </div>
      </Section>

      <Section id="changes" title="9. Changes to these terms" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> these terms may be updated, the current version will
            be the one published on this page, and the effective date will be shown at the top.
            How material changes are communicated has not been decided.
          </p>
        </Prose>
      </Section>

      <Section id="contact" title="10. Contact" badge="Draft">
        <Prose>
          <p>
            <strong>Intended to say:</strong> this section will give the address for questions about
            these terms, corrections, and takedown requests.
          </p>
        </Prose>
        <div className="mt-4">
          <Callout tone="placeholder" title="PLACEHOLDER — requires review before launch">
            <p>
              No contact email address, phone number, or mailing address has been provided, so none
              is shown. Until one exists, the{' '}
              <Link
                href="/suggestions"
                className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
              >
                suggestions form
              </Link>{' '}
              is the only route to reach us.
            </p>
          </Callout>
        </div>
      </Section>
    </PageShell>
  );
}
