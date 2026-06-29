import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import Anthropic from '@anthropic-ai/sdk';
import { ActionSchema, ACTION_JSON_SCHEMA, type ParsedAction } from './schema';
import { SYSTEM_PROMPT, FEW_SHOT_EXAMPLES } from './prompt';

// ---------------------------------------------------------------------------
// AI Action Parser — raw clinician text -> validated ParsedAction.
//
// Two interchangeable backends, selected by AI_PROVIDER:
//   • "anthropic" (default, recommended): strict tool use on the Claude
//     Messages API. We force a single tool call whose `input_schema` is the
//     strict JSON Schema mirror of ActionSchema, so the model can only return a
//     schema-valid object.
//   • "openai": Structured Outputs via response_format.
//
// Both return the same `ParseResult`; everything downstream (executor, webhooks)
// is provider-agnostic.
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; action: ParsedAction }
  | { ok: false; error: string };

export async function parseClinicianMessage(rawText: string): Promise<ParseResult> {
  const provider = (process.env.AI_PROVIDER || 'anthropic').toLowerCase();
  try {
    if (provider === 'anthropic') return await parseWithAnthropic(rawText);
    if (provider === 'openai') return await parseWithOpenAI(rawText);
    return { ok: false, error: `Unsupported AI_PROVIDER: ${provider}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown parser error' };
  }
}

// --- Anthropic (Claude) backend -------------------------------------------

let _anthropic: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// The tool Claude is forced to call. `strict: true` + the JSON Schema guarantee
// the tool input conforms to our action contract. Built untyped and cast at the
// call site so it compiles across @anthropic-ai/sdk versions regardless of
// whether `strict` is in that version's `Tool` type (it is still sent on the wire).
const ACTION_TOOL = {
  name: 'emit_trial_action',
  description:
    'Record the single structured trial-update action extracted from the clinician message. ' +
    'You MUST call this tool exactly once. Use the UNKNOWN action with confidence 0 if the ' +
    'message is not an actionable trial update.',
  input_schema: ACTION_JSON_SCHEMA,
  strict: true,
};

async function parseWithAnthropic(rawText: string): Promise<ParseResult> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

  let message: Anthropic.Message;
  try {
    message = await anthropic().messages.create({
      model,
      max_tokens: 1024,
      // NOTE: no temperature / top_p / thinking — current Claude models (Opus 4.8,
      // Sonnet 4.6, …) reject sampling params, and a forced tool call needs no thinking.
      system: SYSTEM_PROMPT,
      tools: [ACTION_TOOL] as unknown as Anthropic.Tool[],
      tool_choice: { type: 'tool', name: ACTION_TOOL.name },
      messages: [
        {
          role: 'user',
          content: `${FEW_SHOT_EXAMPLES}\n\nNow parse this message:\n"""${rawText.trim()}"""`,
        },
      ],
    });
  } catch (err) {
    // SDK already retried 429/5xx; surface a clean error for the review queue.
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `Anthropic API error (${err.status ?? '?'}): ${err.message}` };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown Anthropic error' };
  }

  if ((message.stop_reason as string) === 'refusal') {
    return { ok: false, error: 'Model refused to process the message.' };
  }

  // Extract the forced tool call. Its `.input` is already schema-shaped JSON.
  const toolUse = message.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined;
  if (!toolUse) {
    const text = message.content.find((b) => b.type === 'text') as Anthropic.TextBlock | undefined;
    return { ok: false, error: text?.text || 'Model did not return a structured action.' };
  }

  // Belt-and-suspenders: validate the tool input against zod even though strict
  // mode already constrained it.
  const safe = ActionSchema.safeParse(toolUse.input);
  if (!safe.success) return { ok: false, error: 'Schema validation failed: ' + safe.error.message };

  safe.data.confidence_score = Math.max(0, Math.min(100, safe.data.confidence_score));
  return { ok: true, action: safe.data };
}

// --- OpenAI backend --------------------------------------------------------

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

async function parseWithOpenAI(rawText: string): Promise<ParseResult> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06';

  const completion = await openai().beta.chat.completions.parse({
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${FEW_SHOT_EXAMPLES}\n\nNow parse this message:\n"""${rawText.trim()}"""`,
      },
    ],
    response_format: zodResponseFormat(ActionSchema, 'trial_action'),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    return { ok: false, error: refusal || 'Model returned no parsed action' };
  }

  const safe = ActionSchema.safeParse(parsed);
  if (!safe.success) return { ok: false, error: 'Schema validation failed: ' + safe.error.message };

  safe.data.confidence_score = Math.max(0, Math.min(100, safe.data.confidence_score));
  return { ok: true, action: safe.data };
}
