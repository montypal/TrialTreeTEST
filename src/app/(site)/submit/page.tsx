import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmissionForm } from '@/components/forms/SubmissionForm';
import { PageHeader, PageShell, Prose, Section } from '@/components/site/Prose';

export const metadata: Metadata = {
  title: 'Trial Submission',
  description:
    'For physicians, coordinators, and research offices: submit a genitourinary oncology trial at a Southern California site for verification before it is listed on TrialTree.',
};

const STEPS = [
  {
    title: 'You submit the study',
    body: 'The form below is stored for the TrialTree team to review. Nothing is published at this point, and nothing appears on any TrialTree board, kiosk, or search result.',
  },
  {
    title: 'A reviewer verifies it',
    body: 'Details are checked against the protocol record and, where needed, confirmed with the site. Reviewers may email you with questions using the address you provide.',
  },
  {
    title: 'It is published, or it comes back to you',
    body: 'Verified studies are placed on the decision tree under the right disease, state, and line of therapy. Anything that cannot be confirmed stays unpublished.',
  },
];

export default function SubmitPage() {
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="For physicians and institutions"
        title="Submit a trial for verification"
        lead="If your site is enrolling a genitourinary oncology study in Southern California, send it here and a reviewer will work through it with you."
      />

      {/* The single most important thing on this page: a submitter who walks
          away believing their study is now live is a safety problem, so this
          sits above the fold, above the form, and is repeated in the success
          state after submitting. */}
      <div className="mt-8 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
        <h2 className="font-display text-lg font-bold text-amber-900">
          Submitting a trial does not publish it
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-900">
          Every submission goes through verification before it appears anywhere on TrialTree. There
          is no automatic listing, no preview link, and no publication timeline we can commit to
          yet. Until a reviewer has confirmed the study, patients and clinicians using this site
          will not see it.
        </p>
      </div>

      <Section title="What happens after you submit">
        <ol className="mt-1 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Is this the right form?">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
            <h3 className="font-display text-sm font-bold text-blue-900">
              Trial submission — you are here
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-blue-900">
              For study teams putting forward a specific trial at their own institution. It asks for
              protocol-level detail and contact information so a reviewer can verify the study with
              you.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-display text-sm font-bold text-slate-900">Suggestions</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              For anyone — patients, caregivers, clinicians — who has noticed a missing trial, a
              listing that looks wrong, or anything else worth telling us. It asks for almost
              nothing and takes a minute.
            </p>
            <Link
              href="/suggestions"
              className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              Go to suggestions instead
            </Link>
          </div>
        </div>
      </Section>

      <Section title="Before you start">
        <Prose>
          <p>
            Only the trial title, your institution, your name, and an email address are required —
            send what you have and a reviewer will follow up for the rest. It helps to have the
            protocol or IRB number and the NCT number to hand if the study is registered.
          </p>
          <p>
            <strong>Do not include patient information.</strong> This form is about the study, not
            about anyone enrolled in it. No names, dates of birth, medical record numbers, or other
            identifiers.
          </p>
        </Prose>
      </Section>

      <Section title="Trial submission form">
        <div className="mt-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
          <SubmissionForm />
        </div>
      </Section>
    </PageShell>
  );
}
