import type { Metadata } from 'next';
import Link from 'next/link';
import { SuggestionForm } from '@/components/forms/SuggestionForm';
import { PageHeader, PageShell, Prose, Section } from '@/components/site/Prose';

export const metadata: Metadata = {
  title: 'Suggestions',
  description:
    'Tell us about a missing trial, a listing that looks wrong, or anything else about TrialTree. A short form — no account, and contact details are optional.',
};

// A trial's detail panel links here with ?trial=<id>&name=<label>. Both are
// untrusted: the id is length-checked by the same schema the API parses, and
// the name is only ever rendered as text so the reader can see what they are
// reporting on.
const MAX_ID = 60; // matches LIMITS.id in src/lib/intake.ts
const MAX_NAME = 200;

function firstString(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim() ? s.trim() : null;
}

export default function SuggestionsPage({
  searchParams,
}: {
  searchParams: { trial?: string | string[]; name?: string | string[] };
}) {
  const trialId = firstString(searchParams.trial);
  const trialName = firstString(searchParams.name);
  const relatedTrial =
    trialId && trialId.length <= MAX_ID
      ? { id: trialId, label: (trialName ?? 'A trial listing').slice(0, MAX_NAME) }
      : null;

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Suggestions"
        title="Spotted something we should fix?"
        lead="A missing study, a status that looks out of date, a page that is hard to follow — tell us in a sentence. All we need is a category and a message; an email address is optional."
      />

      <Section title="Is this the right form?">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
            <h3 className="font-display text-sm font-bold text-blue-900">
              Suggestions — you are here
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-blue-900">
              For anyone. One question, one message, and an email address only if you want a reply.
              Use it for a missing trial, information that is wrong or out of date, or general
              feedback.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-display text-sm font-bold text-slate-900">Trial submission</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              For physicians, coordinators, and research offices putting forward a specific study at
              their own institution. It is longer on purpose: a reviewer needs protocol-level detail
              and a contact to verify against.
            </p>
            <Link
              href="/submit"
              className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              Go to trial submission instead
            </Link>
          </div>
        </div>
      </Section>

      <Section title="What happens to a suggestion">
        <Prose>
          <p>
            A person reads every suggestion. Nothing you send changes a listing on its own — if you
            report that a study has closed or that a detail is wrong, the change is made only after
            it has been checked with the site. We cannot promise a reply, and there is no timeline
            we can commit to yet.
          </p>
          <p>
            <strong>Please leave patient information out.</strong> No names, dates of birth, medical
            record numbers, or addresses. If you are asking whether a specific person might be
            eligible for something, that is a conversation for their oncology team, not this form.
          </p>
        </Prose>
      </Section>

      <Section title="Send a suggestion">
        <div className="mt-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
          <SuggestionForm key={relatedTrial?.id ?? 'none'} relatedTrial={relatedTrial} />
        </div>
      </Section>
    </PageShell>
  );
}
