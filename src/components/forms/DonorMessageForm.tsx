'use client';

import { useState, type FormEvent } from 'react';
import { donorMessageSchema, intakeErrors } from '@/lib/intake';

// ---------------------------------------------------------------------------
// Message of support, shown on the Donate page.
//
// The fields and rules are `donorMessageSchema` from src/lib/intake.ts, so this
// form already matches the route that will eventually accept it. No route posts
// these yet, which is why the endpoint arrives as a prop: with none passed the
// form renders complete but disabled. A form that posted into a 404 would look
// like it had worked, and a message of support that silently vanished is worse
// than one the visitor was told they could not send yet.
// ---------------------------------------------------------------------------

type FieldName = 'displayName' | 'message';
type Errors = Partial<Record<FieldName, string>>;
type Status = 'idle' | 'submitting' | 'success' | 'error';

const FIELD_ORDER: FieldName[] = ['displayName', 'message'];

const INPUT_BASE =
  'mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 sm:text-sm';
const INPUT_OK = 'border-slate-300 focus:border-blue-500 focus:ring-blue-200';
const INPUT_ERROR = 'border-rose-400 focus:border-rose-500 focus:ring-rose-200';

function inputClass(error?: string): string {
  return `${INPUT_BASE} ${error ? INPUT_ERROR : INPUT_OK}`;
}

function fieldId(name: FieldName): string {
  return `donor-${name}`;
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

function isFieldName(key: string): key is FieldName {
  return key === 'displayName' || key === 'message';
}

export function DonorMessageForm({ endpoint }: { endpoint?: string }) {
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const accepting = typeof endpoint === 'string' && endpoint.length > 0;

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
    const element = document.getElementById(fieldId(first));
    if (element instanceof HTMLElement) element.focus();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!endpoint || status === 'submitting') return;

    const payload: Record<string, string> = {
      displayName: displayName.trim(),
      website: honeypot,
    };
    if (message.trim()) payload.message = message.trim();

    const parsed = donorMessageSchema.safeParse(payload);
    if (!parsed.success) {
      const { message: headline, fieldErrors } = intakeErrors(parsed.error);
      const mapped: Errors = {};
      for (const [key, messages] of Object.entries(fieldErrors)) {
        if (isFieldName(key) && messages.length > 0) mapped[key] = messages[0];
      }
      setErrors(mapped);
      setStatus('error');
      setFormError(headline);
      focusFirstError(mapped);
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus('submitting');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus('error');
        setFormError(readServerError(json) ?? 'That message could not be sent. Please try again.');
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
        <h3 className="font-display text-lg font-bold">Message received</h3>
        <p className="mt-2 text-sm leading-relaxed">
          Thank you. Messages are read and reviewed by a person before any of them appear on the
          site.
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="relative">
      {/* Off-screen honeypot — see SubmissionForm for the reasoning. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor="donor-website">Website</label>
        <input
          id="donor-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {!accepting ? (
        <div
          role="status"
          className="mb-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600"
        >
          <strong className="font-semibold text-slate-800">
            Messages cannot be sent through the site yet.
          </strong>{' '}
          The fields below show exactly what will be asked for once this is connected. Nothing typed
          here is stored or sent.
        </div>
      ) : null}

      <fieldset
        disabled={!accepting || status === 'submitting'}
        className="grid gap-4 sm:grid-cols-2"
      >
        <legend className="sr-only">Message of support</legend>

        <div>
          <label
            htmlFor={fieldId('displayName')}
            className="block text-sm font-semibold text-slate-800"
          >
            Name to show
            <span className="ml-1 text-rose-600" aria-hidden>
              *
            </span>
          </label>
          <p id={`${fieldId('displayName')}-hint`} className="mt-1 text-xs leading-relaxed text-slate-500">
            How you would like to be credited if your message is published. A first name or initials
            is fine.
          </p>
          <input
            id={fieldId('displayName')}
            type="text"
            required
            autoComplete="name"
            value={displayName}
            aria-invalid={errors.displayName ? true : undefined}
            aria-describedby={
              errors.displayName
                ? `${fieldId('displayName')}-hint ${fieldId('displayName')}-error`
                : `${fieldId('displayName')}-hint`
            }
            onChange={(event) => {
              setDisplayName(event.target.value);
              clearError('displayName');
            }}
            className={inputClass(errors.displayName)}
          />
          {errors.displayName ? (
            <p
              id={`${fieldId('displayName')}-error`}
              role="alert"
              className="mt-1.5 text-xs font-semibold text-rose-700"
            >
              {errors.displayName}
            </p>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor={fieldId('message')}
            className="block text-sm font-semibold text-slate-800"
          >
            Your message
            <span className="ml-1.5 text-xs font-normal text-slate-500">optional</span>
          </label>
          <p id={`${fieldId('message')}-hint`} className="mt-1 text-xs leading-relaxed text-slate-500">
            Please do not include patient names or any other identifying information — messages may
            be published after review.
          </p>
          <textarea
            id={fieldId('message')}
            rows={4}
            value={message}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={
              errors.message
                ? `${fieldId('message')}-hint ${fieldId('message')}-error`
                : `${fieldId('message')}-hint`
            }
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
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800"
        >
          {formError}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!accepting || status === 'submitting'}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {status === 'submitting'
            ? 'Sending…'
            : accepting
              ? 'Send message'
              : 'Sending is not available yet'}
        </button>
        <span className="text-xs text-slate-500">
          Messages are reviewed before they appear anywhere on this site.
        </span>
      </div>
    </form>
  );
}
