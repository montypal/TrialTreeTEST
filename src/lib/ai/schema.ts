import { z } from 'zod';

// The strict action contract the LLM must emit. We validate every field with
// zod before it is allowed anywhere near the database.

export const ActionType = z.enum([
  'CLOSE_TRIAL',
  'OPEN_TRIAL',
  'ADD_COHORT',
  'UPDATE_CRITERIA',
  'UNKNOWN', // the model could not map the message to a supported action
]);
export type ActionType = z.infer<typeof ActionType>;

export const RecruitmentStatus = z.enum(['RECRUITING', 'WAITLISTED', 'CLOSED', 'SUSPENDED']);

export const TargetIdentifier = z.object({
  nct_id: z.string().nullable().describe('NCT id like NCT04123456 if present, else null'),
  protocol_number: z.string().nullable().describe('Institutional protocol number if present, else null'),
  shorthand: z
    .string()
    .nullable()
    .describe('Human shorthand the clinician used, e.g. "the Phase II bladder trial"'),
});

export const ActionPayload = z.object({
  new_status: RecruitmentStatus.nullable().describe('Target status for OPEN/CLOSE actions'),
  cohort_label: z.string().nullable().describe('Cohort/arm name for ADD_COHORT'),
  criteria_text: z.string().nullable().describe('New eligibility criteria text for UPDATE_CRITERIA'),
  notes: z.string().nullable().describe('Any extra free-text context worth storing'),
});

export const ActionSchema = z.object({
  action: ActionType,
  target_trial_identifier: TargetIdentifier,
  location: z.string().nullable().describe('SoCal institution name, e.g. "City of Hope", "UCLA"'),
  payload: ActionPayload,
  // NB: no .min/.max here — OpenAI Structured Outputs rejects unsupported
  // numeric range keywords on some model versions. We clamp in code instead.
  confidence_score: z.number().describe('0-100 certainty of the extracted intent'),
  reasoning: z.string().describe('One sentence explaining the interpretation'),
});

export type ParsedAction = z.infer<typeof ActionSchema>;

// ---------------------------------------------------------------------------
// JSON Schema mirror of ActionSchema, used as the Anthropic tool `input_schema`
// with `strict: true` (Structured Outputs) so the model can ONLY emit a payload
// that matches this shape. The zod schema above is still the runtime validator;
// this is the wire contract. Keep the two in sync.
//
// Constraints required by Anthropic Structured Outputs: every object sets
// `additionalProperties: false` and lists all keys in `required`; nullable fields
// use `anyOf [..., {type:'null'}]`; numeric ranges (min/max) are NOT allowed,
// which is why confidence_score is an unconstrained number (clamped in code).
// ---------------------------------------------------------------------------
const nullableString = (description: string) => ({
  anyOf: [{ type: 'string' }, { type: 'null' }],
  description,
});

export const ACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'target_trial_identifier', 'location', 'payload', 'confidence_score', 'reasoning'],
  properties: {
    action: {
      type: 'string',
      enum: ['CLOSE_TRIAL', 'OPEN_TRIAL', 'ADD_COHORT', 'UPDATE_CRITERIA', 'UNKNOWN'],
      description: 'The single supported action this message maps to.',
    },
    target_trial_identifier: {
      type: 'object',
      additionalProperties: false,
      required: ['nct_id', 'protocol_number', 'shorthand'],
      properties: {
        nct_id: nullableString('NCT id like NCT04123456 if present, else null.'),
        protocol_number: nullableString('Institutional protocol number if present, else null.'),
        shorthand: nullableString('Human shorthand the clinician used (e.g. "the Phase II bladder trial"), else null.'),
      },
    },
    location: nullableString('SoCal institution name (e.g. "City of Hope", "UCLA"), or null if not stated.'),
    payload: {
      type: 'object',
      additionalProperties: false,
      required: ['new_status', 'cohort_label', 'criteria_text', 'notes'],
      properties: {
        new_status: {
          anyOf: [
            { type: 'string', enum: ['RECRUITING', 'WAITLISTED', 'CLOSED', 'SUSPENDED'] },
            { type: 'null' },
          ],
          description: 'Target status for OPEN/CLOSE actions, else null.',
        },
        cohort_label: nullableString('Cohort/arm name for ADD_COHORT, else null.'),
        criteria_text: nullableString('New eligibility criteria text for UPDATE_CRITERIA, else null.'),
        notes: nullableString('Any extra free-text context worth storing, else null.'),
      },
    },
    confidence_score: { type: 'number', description: '0-100 certainty of the extracted intent.' },
    reasoning: { type: 'string', description: 'One concise sentence explaining the interpretation.' },
  },
} as const;
