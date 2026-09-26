'use client';

import { useState, type FormEvent } from 'react';
import {
  intakeErrors,
  suggestionSchema,
  SUGGESTION_KINDS,
  SUGGESTION_KIND_LABELS,
  type SuggestionKind,
} from '@/lib/intake';

// ---------------------------------------------------------------------------
// Suggestions form — the light-weight counterpart to the trial submission.
//
// Only the kind and the message are required. Someone who has noticed that a
// listing is wrong should be able to say so in one screen without leaving
// contact details behind, so the email field is optional and labelled as such.
//
// Validation runs `suggestionSchema` from src/lib/intake.ts — the same schema
// POST /api/suggestions parses — so the two cannot disagree about what is
// acceptable.
// ---------------------------------------------------------------------------

const ENDPOINT = '/api/suggestions';

type FieldName = 'kind' | 'nctId' | 'contactEmail' | 'message';
type Errors = Partial<Record<FieldName, string>>;
type Status = 'idle' | 'submitting' | 'success' | 'error';

// Visual order, which is also the order the first invalid field is looked for.
const FIELD_ORDER: FieldName[] = ['kind', 'nctId', 'contactEmail', 'message'];

/** Why someone would pick each kind. The labels themselves come from intake. */
const KIND_HELP: Record<SuggestionKind, string> = {
  MISSING_TRIAL: 'A study you know is open at a Southern California site but cannot find here.',
  INCORRECT_INFO: 'A listing shows the wrong status, site, investigator, or details.',
  GENERAL_FEEDBACK: 'Anything else — including what is hard to use or hard to understand.',
};

const INPUT_BASE =
  'mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 sm:text-sm';
const INPUT_OK = 'border-slate-300 focus:border-blue-500 focus:ring-blue-200';
const INPUT_ERROR = 'border-rose-400 focus:border-rose-500 focus:ring-rose-200';

function inputClass(error?: string): string {
  return `${INPUT_BASE} ${error ? INPUT_ERROR : INPUT_OK}`;
}

function fieldId(name: FieldName): string {
  return `suggestion-${name}`;
}

function describedBy(id: string, hasHint: boolean, error: string | undefined): string | undefined {
  const parts: string[] = [];
  if (hasHint) parts.push(`${id}-hint`);
  if (error) parts.push(`${id}-error`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readServerError(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;
  return typeof root.error === 'string' ? root.error : null;
}

function readServerFieldErrors(payload: unknown): Record<string, string> {
  const root = asRecord(payload);
  const source = root ? asRecord(root.fieldErrors) : null;
  if (!source) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') out[key] = value;
    else if (Array.isArray(value) && typeof value[0] === 'string') out[key] = value[0];
  }
  return out;
}

function isFieldName(key: string): key is FieldName {
  return key === 'kind' || key === 'nctId' || key === 'contactEmail' || key === 'message';
}

type Props = {
  /** Set when the reader arrived from a trial's "report a problem" link. The
      suggestion is then filed against that trial and defaults to "incorrect
      information", but the reader can detach it — they may have come to say
      something else entirely. */
  relatedTrial?: { id: string; label: string } | null;
};

export function SuggestionForm({ relatedTrial = null }: Props) {
  const [attached, setAttached] = useState(relatedTrial);
  const [kind, setKind] = useState<SuggestionKind | ''>(relatedTrial ? 'INCORRECT_INFO' : '');
  const [nctId, setNctId] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const clearError = (name: FieldName) => {
    setErrors((previous) => {
      if (!previous[name]) return previous;
      const next: Errors = { ...previous };
      delete next[name];
      return next;
    });
  };

  const focusFirstError = (found: Errors) => {
    const first = FIELD_ORDER.find((name) => found[name]);
    if (!first) return;
    // The radio group has no single input to focus, so aim at the first option.
    const targetId = first === 'kind' ? `${fieldId('kind')}-0` : fieldId(first);
    const element = document.getElementById(targetId);
    if (element instanceof HTMLElement) element.focus();
  };

  const applyFieldErrors = (fieldErrors: Record<string, string>, fallback: string) => {
    const mapped: Errors = {};
    const unmatched: string[] = [];
    for (const [key, text] of Object.entries(fieldErrors)) {
      if (isFieldName(key)) mapped[key] = text;
      else unmatched.push(`${key}: ${text}`);
    }
    setErrors(mapped);
    setStatus('error');
    setFormError(unmatched.length > 0 ? `${fallback} (${unmatched.join('; ')})` : fallback);
    focusFirstError(mapped);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    // Blank optionals are omitted rather than sent as empty strings.
    const payload: Record<string, string> = { kind, message: message.trim(), website: honeypot };
    if (nctId.trim()) payload.nctId = nctId.trim();
    if (contactEmail.trim()) payload.contactEmail = contactEmail.trim();
    if (attached) payload.relatedTrialId = attached.id;

    const parsed = suggestionSchema.safeParse(payload);
    if (!parsed.success) {
      const { message: headline, fieldErrors } = intakeErrors(parsed.error);
      const flattened: Record<string, string> = {};
      for (const [key, messages] of Object.entries(fieldErrors)) {
        if (messages.length > 0) flattened[key] = messages[0];
      }
      applyFieldErrors(flattened, headline);
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus('submitting');

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        applyFieldErrors(
          readServerFieldErrors(json),
          readServerError(json) ?? 'This suggestion was not accepted. Please try again.',
        );
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setFormError('We could not reach the server. Nothing was sent — please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"
      >
        <h3 className="font-display text-lg font-bold">Thank you</h3>
        <p className="mt-2 text-sm leading-relaxed">
          Your suggestion has been recorded. A person reads every one; a listing is only changed
          after the detail has been checked with the site.
        </p>
        <button
          type="button"
          onClick={() => {
            setAttached(null);
            setKind('');
            setNctId('');
            setContactEmail('');
            setMessage('');
            setHoneypot('');
            setStatus('idle');
          }}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          Send another suggestion
        </button>
      </div>
    );
  }

  const kindErrorId = `${fieldId('kind')}-error`;

  return (
    <form noValidate onSubmit={onSubmit} className="relative">
      {/* Off-screen honeypot — see SubmissionForm for the reasoning. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor="suggestion-website">Website</label>
        <input
          id="suggestion-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {attached && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="min-w-0 break-words text-sm text-blue-900">
            <span className="font-semibold">About this listing:</span> {attached.label}
          </p>
          <button
            type="button"
            onClick={() => setAttached(null)}
            className="inline-flex min-h-[44px] shrink-0 items-center text-sm font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-900 sm:min-h-0"
          >
            Not about this trial
          </button>
        </div>
      )}

      <fieldset disabled={status === 'submitting'}>
        <legend className="text-sm font-semibold text-slate-800">
          What is this about?
          <span className="ml-1 text-rose-600" aria-hidden>
            *
          </span>
        </legend>
        <div className="mt-2 space-y-2">
          {SUGGESTION_KINDS.map((value, index) => {
            const optionId = `${fieldId('kind')}-${index}`;
            return (
              <div
                key={value}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300"
              >
                <input
                  id={optionId}
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  aria-describedby={errors.kind ? kindErrorId : undefined}
                  aria-invalid={errors.kind ? true : undefined}
                  onChange={() => {
                    setKind(value);
                    clearError('kind');
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                />
                <label htmlFor={optionId} className="min-w-0 cursor-pointer">
                  <span className="block text-sm font-semibold text-slate-800">
                    {SUGGESTION_KIND_LABELS[value]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {KIND_HELP[value]}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
        {errors.kind ? (
          <p id={kindErrorId} role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
            {errors.kind}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="mt-6 grid gap-4 sm:grid-cols-2" disabled={status === 'submitting'}>
        <legend className="sr-only">Details</legend>

        <div>
          <label htmlFor={fieldId('nctId')} className="block text-sm font-semibold text-slate-800">
            NCT number
            <span className="ml-1.5 text-xs font-normal text-slate-500">optional</span>
          </label>
          <p id={`${fieldId('nctId')}-hint`} className="mt-1 text-xs text-slate-500">
            If your note is about one specific study.
          </p>
          <input
            id={fieldId('nctId')}
            type="text"
            autoComplete="off"
            placeholder="NCT01234567"
            value={nctId}
            aria-invalid={errors.nctId ? true : undefined}
            aria-describedby={describedBy(fieldId('nctId'), true, errors.nctId)}
            onChange={(event) => {
              setNctId(event.target.value);
              clearError('nctId');
            }}
            className={inputClass(errors.nctId)}
          />
          {errors.nctId ? (
            <p
              id={`${fieldId('nctId')}-error`}
              role="alert"
              className="mt-1.5 text-xs font-semibold text-rose-700"
            >
              {errors.nctId}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={fieldId('contactEmail')}
            className="block text-sm font-semibold text-slate-800"
          >
            Email
            <span className="ml-1.5 text-xs font-normal text-slate-500">optional</span>
          </label>
          <p id={`${fieldId('contactEmail')}-hint`} className="mt-1 text-xs text-slate-500">
            Only if you would like a reply.
          </p>
          <input
            id={fieldId('contactEmail')}
            type="email"
            autoComplete="email"
            value={contactEmail}
            aria-invalid={errors.contactEmail ? true : undefined}
            aria-describedby={describedBy(fieldId('contactEmail'), true, errors.contactEmail)}
            onChange={(event) => {
              setContactEmail(event.target.value);
              clearError('contactEmail');
            }}
            className={inputClass(errors.contactEmail)}
          />
          {errors.contactEmail ? (
            <p
              id={`${fieldId('contactEmail')}-error`}
              role="alert"
              className="mt-1.5 text-xs font-semibold text-rose-700"
            >
              {errors.contactEmail}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor={fieldId('message')}
            className="block text-sm font-semibold text-slate-800"
          >
            Your message
            <span className="ml-1 text-rose-600" aria-hidden>
              *
            </span>
          </label>
          <p id={`${fieldId('message')}-hint`} className="mt-1 text-xs text-slate-500">
            Please do not include patient names, dates of birth, medical record numbers, or any
            other identifying information.
          </p>
          <textarea
            id={fieldId('message')}
            rows={5}
            required
            value={message}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={describedBy(fieldId('message'), true, errors.message)}
            onChange={(event) => {
              setMessage(event.target.value);
              clearError('message');
            }}
            className={`${inputClass(errors.message)} resize-y leading-relaxed`}
          />
          {errors.message ? (
            <p
              id={`${fieldId('message')}-error`}
              role="alert"
              className="mt-1.5 text-xs font-semibold text-rose-700"
            >
              {errors.message}
            </p>
          ) : null}
        </div>
      </fieldset>

      {formError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"
        >
          {formError}
        </div>
      ) : null}

      <div className="mt-6">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          {status === 'submitting' ? 'Sending…' : 'Send suggestion'}
        </button>
      </div>
    </form>
  );
}
