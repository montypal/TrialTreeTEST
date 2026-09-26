'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { intakeErrors, trialSubmissionSchema } from '@/lib/intake';
import { CENTERS } from '@/lib/locations';
import { CANCERS } from '@/lib/cancerColors';

// ---------------------------------------------------------------------------
// Trial submission form — physicians, coordinators, and research offices.
//
// Validation runs `trialSubmissionSchema` from src/lib/intake.ts, the same
// schema POST /api/submissions parses. Re-describing the rules here would
// guarantee the two drift apart, and on a clinical intake form the failure mode
// of drift is a submitter who cannot work out why the server rejected them.
//
// Nothing here publishes a trial. The copy around the form says so, and the
// success state repeats it, because a submitter who assumes their study is now
// live is a patient-safety problem, not just a UX one.
// ---------------------------------------------------------------------------

const ENDPOINT = '/api/submissions';

// Ordered to match the visual layout, because this is also the order the first
// invalid field is looked for in.
const FIELDS = [
  'title',
  'nctId',
  'protocolNumber',
  'phase',
  'diseaseArea',
  'institution',
  'institutionSite',
  'principalInvestigator',
  'submitterName',
  'submitterRole',
  'submitterEmail',
  'submitterPhone',
  'notes',
] as const;

type FieldName = (typeof FIELDS)[number];
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>;
type Status = 'idle' | 'submitting' | 'success' | 'error';

const EMPTY: Values = {
  title: '',
  nctId: '',
  protocolNumber: '',
  phase: '',
  diseaseArea: '',
  institution: '',
  institutionSite: '',
  principalInvestigator: '',
  submitterName: '',
  submitterRole: '',
  submitterEmail: '',
  submitterPhone: '',
  notes: '',
};

const PHASES = [
  'Phase 1',
  'Phase 1/2',
  'Phase 2',
  'Phase 2/3',
  'Phase 3',
  'Phase 4',
  'Not applicable / other',
];

const ROLES = [
  'Principal investigator',
  'Sub-investigator',
  'Study coordinator',
  'Research nurse',
  'Regulatory / research office',
  'Referring clinician',
  'Other',
];

const DISEASE_AREAS = [
  ...CANCERS.map((cancer) => cancer.label),
  'Other genitourinary',
  'Multiple genitourinary diseases',
];

const INPUT_BASE =
  'mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 sm:text-sm';
const INPUT_OK = 'border-slate-300 focus:border-blue-500 focus:ring-blue-200';
const INPUT_ERROR = 'border-rose-400 focus:border-rose-500 focus:ring-rose-200';

function inputClass(error?: string): string {
  return `${INPUT_BASE} ${error ? INPUT_ERROR : INPUT_OK}`;
}

function fieldId(name: FieldName): string {
  return `submission-${name}`;
}

/** id + aria wiring for an input, given whatever describing text it has. */
function ariaFor(id: string, hasHint: boolean, error: string | undefined) {
  const described: string[] = [];
  if (hasHint) described.push(`${id}-hint`);
  if (error) described.push(`${id}-error`);
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described.length > 0 ? described.join(' ') : undefined,
  };
}

function Field({
  name,
  label,
  required,
  hint,
  error,
  wide,
  children,
}: {
  name: FieldName;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const id = fieldId(name);
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
        {required ? (
          <span className="ml-1 text-rose-600" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-slate-500">optional</span>
        )}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** The route answers `{ ok: false, error, fieldErrors }` on every rejection. */
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

export function SubmissionForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const setValue = (name: FieldName, value: string) => {
    setValues((previous) => {
      const next: Values = { ...previous };
      next[name] = value;
      return next;
    });
    setErrors((previous) => {
      if (!previous[name]) return previous;
      const next: Errors = { ...previous };
      delete next[name];
      return next;
    });
  };

  // Every input already carries a stable id for its <label for>, so the first
  // invalid field can be focused by id rather than threading a ref through 13
  // fields. Screen-reader users land on the input whose error text they need.
  const focusFirstError = (found: Errors) => {
    const first = FIELDS.find((name) => found[name]);
    if (!first) return;
    const element = document.getElementById(fieldId(first));
    if (element instanceof HTMLElement) element.focus();
  };

  /** Split shared-schema (or server) field errors across the inputs. */
  const applyFieldErrors = (fieldErrors: Record<string, string>, fallback: string) => {
    const mapped: Errors = {};
    const unmatched: string[] = [];
    for (const [key, message] of Object.entries(fieldErrors)) {
      const known = FIELDS.find((name) => name === key);
      if (known) mapped[known] = message;
      else unmatched.push(`${key}: ${message}`);
    }
    setErrors(mapped);
    setStatus('error');
    setFormError(unmatched.length > 0 ? `${fallback} (${unmatched.join('; ')})` : fallback);
    focusFirstError(mapped);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    // Blank optional fields are dropped rather than sent as empty strings: the
    // schema treats a missing key and a blank string the same way, and a
    // smaller payload is easier to read in the review queue.
    const payload: Record<string, string> = {};
    for (const name of FIELDS) {
      const trimmed = values[name].trim();
      if (trimmed) payload[name] = trimmed;
    }
    payload.website = honeypot;

    const parsed = trialSubmissionSchema.safeParse(payload);
    if (!parsed.success) {
      const { message, fieldErrors } = intakeErrors(parsed.error);
      const flattened: Record<string, string> = {};
      for (const [key, messages] of Object.entries(fieldErrors)) {
        if (messages.length > 0) flattened[key] = messages[0];
      }
      applyFieldErrors(flattened, message);
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
          readServerError(json) ??
            'This submission was not accepted. Please review the fields and try again.',
        );
        return;
      }

      const root = asRecord(json);
      setReference(root && typeof root.id === 'string' ? root.id : null);
      setStatus('success');
    } catch {
      setStatus('error');
      setFormError(
        'We could not reach the server. Check your connection and try again — nothing was submitted.',
      );
    }
  };

  if (status === 'success') {
    return (
      <div
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"
      >
        <h3 className="font-display text-lg font-bold">Submission received</h3>
        <p className="mt-2 text-sm leading-relaxed">
          Thank you. This study has <strong className="font-semibold">not</strong> been published.
          It is now queued for verification, and it will only appear on TrialTree once a reviewer
          has confirmed it against the protocol and the site.
        </p>
        {reference ? (
          <p className="mt-3 text-sm">
            Reference: <span className="break-all font-mono text-xs">{reference}</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setValues(EMPTY);
            setHoneypot('');
            setReference(null);
            setStatus('idle');
          }}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          Submit another trial
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="relative">
      {/* Honeypot. Positioned off-screen rather than display:none so automated
          form-fillers still see it, and hidden from assistive technology and
          the tab order so nobody else does. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor="submission-website">Website</label>
        <input
          id="submission-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      <p className="text-xs text-slate-500">
        Fields marked <span className="font-semibold text-rose-600">*</span> are required.
      </p>

      <fieldset className="mt-5" disabled={status === 'submitting'}>
        <legend className="font-display text-base font-bold text-slate-900">The study</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field name="title" label="Trial title" required error={errors.title} wide>
            <input
              {...ariaFor(fieldId('title'), false, errors.title)}
              type="text"
              required
              value={values.title}
              onChange={(event) => setValue('title', event.target.value)}
              className={inputClass(errors.title)}
            />
          </Field>

          <Field
            name="nctId"
            label="NCT number"
            hint="If the study is registered on ClinicalTrials.gov."
            error={errors.nctId}
          >
            <input
              {...ariaFor(fieldId('nctId'), true, errors.nctId)}
              type="text"
              autoComplete="off"
              placeholder="NCT01234567"
              value={values.nctId}
              onChange={(event) => setValue('nctId', event.target.value)}
              className={inputClass(errors.nctId)}
            />
          </Field>

          <Field
            name="protocolNumber"
            label="Protocol / IRB number"
            hint="The local identifier your site uses."
            error={errors.protocolNumber}
          >
            <input
              {...ariaFor(fieldId('protocolNumber'), true, errors.protocolNumber)}
              type="text"
              value={values.protocolNumber}
              onChange={(event) => setValue('protocolNumber', event.target.value)}
              className={inputClass(errors.protocolNumber)}
            />
          </Field>

          <Field name="phase" label="Phase" error={errors.phase}>
            <select
              {...ariaFor(fieldId('phase'), false, errors.phase)}
              value={values.phase}
              onChange={(event) => setValue('phase', event.target.value)}
              className={inputClass(errors.phase)}
            >
              <option value="">Select a phase…</option>
              {PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
          </Field>

          <Field name="diseaseArea" label="Disease area" error={errors.diseaseArea}>
            <select
              {...ariaFor(fieldId('diseaseArea'), false, errors.diseaseArea)}
              value={values.diseaseArea}
              onChange={(event) => setValue('diseaseArea', event.target.value)}
              className={inputClass(errors.diseaseArea)}
            >
              <option value="">Select a disease area…</option>
              {DISEASE_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-8" disabled={status === 'submitting'}>
        <legend className="font-display text-base font-bold text-slate-900">The site</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            name="institution"
            label="Institution"
            required
            hint="Start typing — the Southern California centers TrialTree already covers will be suggested."
            error={errors.institution}
          >
            <input
              {...ariaFor(fieldId('institution'), true, errors.institution)}
              type="text"
              required
              list="submission-institutions"
              value={values.institution}
              onChange={(event) => setValue('institution', event.target.value)}
              className={inputClass(errors.institution)}
            />
            <datalist id="submission-institutions">
              {CENTERS.map((center) => (
                <option key={center.slug} value={center.name} />
              ))}
            </datalist>
          </Field>

          <Field
            name="institutionSite"
            label="Department or site"
            hint="For example the specific campus or clinic."
            error={errors.institutionSite}
          >
            <input
              {...ariaFor(fieldId('institutionSite'), true, errors.institutionSite)}
              type="text"
              value={values.institutionSite}
              onChange={(event) => setValue('institutionSite', event.target.value)}
              className={inputClass(errors.institutionSite)}
            />
          </Field>

          <Field
            name="principalInvestigator"
            label="Principal investigator"
            error={errors.principalInvestigator}
            wide
          >
            <input
              {...ariaFor(fieldId('principalInvestigator'), false, errors.principalInvestigator)}
              type="text"
              value={values.principalInvestigator}
              onChange={(event) => setValue('principalInvestigator', event.target.value)}
              className={inputClass(errors.principalInvestigator)}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-8" disabled={status === 'submitting'}>
        <legend className="font-display text-base font-bold text-slate-900">About you</legend>
        <p className="mt-1 text-sm text-slate-500">
          So a reviewer can come back to you with questions about the protocol.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field name="submitterName" label="Your name" required error={errors.submitterName}>
            <input
              {...ariaFor(fieldId('submitterName'), false, errors.submitterName)}
              type="text"
              required
              autoComplete="name"
              value={values.submitterName}
              onChange={(event) => setValue('submitterName', event.target.value)}
              className={inputClass(errors.submitterName)}
            />
          </Field>

          <Field name="submitterRole" label="Your role" error={errors.submitterRole}>
            <select
              {...ariaFor(fieldId('submitterRole'), false, errors.submitterRole)}
              value={values.submitterRole}
              onChange={(event) => setValue('submitterRole', event.target.value)}
              className={inputClass(errors.submitterRole)}
            >
              <option value="">Select a role…</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </Field>

          <Field name="submitterEmail" label="Email" required error={errors.submitterEmail}>
            <input
              {...ariaFor(fieldId('submitterEmail'), false, errors.submitterEmail)}
              type="email"
              required
              autoComplete="email"
              value={values.submitterEmail}
              onChange={(event) => setValue('submitterEmail', event.target.value)}
              className={inputClass(errors.submitterEmail)}
            />
          </Field>

          <Field name="submitterPhone" label="Phone" error={errors.submitterPhone}>
            <input
              {...ariaFor(fieldId('submitterPhone'), false, errors.submitterPhone)}
              type="tel"
              autoComplete="tel"
              value={values.submitterPhone}
              onChange={(event) => setValue('submitterPhone', event.target.value)}
              className={inputClass(errors.submitterPhone)}
            />
          </Field>

          <Field
            name="notes"
            label="Notes for the reviewer"
            hint="Cohorts currently open, enrollment caps, anything a reviewer should know. Please do not include patient information."
            error={errors.notes}
            wide
          >
            <textarea
              {...ariaFor(fieldId('notes'), true, errors.notes)}
              rows={5}
              value={values.notes}
              onChange={(event) => setValue('notes', event.target.value)}
              className={`${inputClass(errors.notes)} resize-y leading-relaxed`}
            />
          </Field>
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          {status === 'submitting' ? 'Submitting…' : 'Submit for verification'}
        </button>
        <span className="text-xs text-slate-500">Submitting does not publish this trial.</span>
      </div>
    </form>
  );
}
