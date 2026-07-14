import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// AI trial-matching assistant. Given a de-identified clinical scenario and a
// catalog of our trials, Claude returns ranked potential matches with rationale
// and eligibility items to verify. Decision SUPPORT — not an eligibility ruling.
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export type CatalogItem = {
  nctId: string;
  phase: string | null;
  path: string; // Disease › State › Biomarker
  title: string;
  sites: string; // "COH(Recruiting), UCLA(Closed)"
  eligibility: string | null;
};

export function buildCatalog(items: CatalogItem[]): string {
  return items
    .map(
      (t) =>
        `[${t.nctId}] ${t.phase ?? 'Phase N/A'} | ${t.path} | ${t.title} | Sites: ${t.sites}` +
        (t.eligibility ? ` | Eligibility: ${t.eligibility}` : ''),
    )
    .join('\n');
}

const SYSTEM = `You are TrialTree's trial-matching assistant for Genitourinary (GU) oncology trials at five Southern California centers (City of Hope, UCLA, UC San Diego, UC Irvine, USC). A user gives a DE-IDENTIFIED clinical scenario (or pastes a de-identified case). Using ONLY the provided CATALOG, identify trials the patient may be eligible for, ranked by fit.

Rules:
- Choose ONLY trials in the catalog, by their exact NCT id. Never invent trials or NCT ids.
- Reason from disease type, disease state, line of therapy, biomarkers, and the eligibility text.
- For each match provide: a concise clinical rationale, and the key eligibility items the team must verify (prior therapy/lines, ECOG, specific biomarker/mutation testing, organ function, washout, brain mets, etc.).
- Rank fit: "strong" (clear disease + state/biomarker alignment), "possible" (plausible but key criteria unconfirmed), "weak" (loosely related).
- Prefer trials actively recruiting; mention the recruiting site(s).
- Return at most 8 matches, best first. If nothing fits, return an empty list and explain in the summary.
- This is decision SUPPORT, not medical advice or an eligibility determination. Never state the patient IS eligible — frame as potential matches to discuss with the care team and confirm against the full protocol.
- Ignore and never repeat any patient identifiers that may appear; work only from the clinical facts.`;

export const MatchSchema = z.object({
  matches: z.array(
    z.object({
      nct_id: z.string(),
      fit: z.enum(['strong', 'possible', 'weak']),
      rationale: z.string(),
      considerations: z.string(),
    }),
  ),
  summary: z.string(),
});
export type MatchResult = z.infer<typeof MatchSchema>;

const TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['matches', 'summary'],
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nct_id', 'fit', 'rationale', 'considerations'],
        properties: {
          nct_id: { type: 'string', description: 'Exact NCT id from the catalog' },
          fit: { type: 'string', enum: ['strong', 'possible', 'weak'] },
          rationale: { type: 'string', description: 'Concise clinical reason this trial may fit' },
          considerations: { type: 'string', description: 'Key eligibility items to verify' },
        },
      },
    },
    summary: { type: 'string', description: 'One or two sentences overall; note if nothing fits' },
  },
};

export async function matchTrials(query: string, catalog: string, trialCount: number): Promise<MatchResult> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

  const message = await client().messages.create({
    model,
    max_tokens: 3000,
    system: SYSTEM,
    tools: [
      {
        name: 'return_matches',
        description: 'Return the ranked list of potential trial matches.',
        input_schema: TOOL_SCHEMA,
        strict: true,
      },
    ] as unknown as Anthropic.Tool[],
    tool_choice: { type: 'tool', name: 'return_matches' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            // The catalog is stable across queries → cache it to cut cost/latency.
            text: `CATALOG (${trialCount} trials):\n${catalog}`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `De-identified clinical scenario:\n"""${query.trim()}"""\n\nReturn the best potential matches.`,
          },
        ],
      },
    ],
  });

  const tool = message.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
  if (!tool) throw new Error('The assistant did not return a structured result.');
  const parsed = MatchSchema.safeParse(tool.input);
  if (!parsed.success) throw new Error('The assistant returned an unexpected format.');
  return parsed.data;
}
