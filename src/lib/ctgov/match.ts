import { resolveLocationSlug, locationLabel } from '@/lib/locations';
import { cleanPi } from '@/lib/pi';
import { formatPhase, type CtgovStudy, type CtgovLocation } from './client';

// ---------------------------------------------------------------------------
// Propose — never assign — a ClinicalTrials.gov record for a TrialTree trial.
//
// Some curated trials arrive carrying only an institutional IRB/protocol
// number. A human can usually find the matching CT.gov record by searching,
// and this module does the searching and the arithmetic for them. It stops
// deliberately short of writing anything: a WRONG trial↔NCT link is worse than
// no link at all, because it puts someone else's eligibility criteria and
// someone else's study contact in front of a patient. Everything here is a
// proposal with its reasoning spelled out; only the CONFIRM path in
// /api/admin/nct-match — a human click — ever touches Trial.nctId.
//
// Failure modes this code does NOT solve, and which the review UI should keep
// saying out loud:
//   • CT.gov search is fuzzy and relevance-ranked. The correct record can be
//     absent from every query we run, and a plausible wrong one can rank first.
//   • Institutional protocol numbers are not globally unique. Somebody at every
//     center has a study numbered 21345. An exact id hit is strong evidence,
//     never proof.
//   • Registry titles drift from the titles clinicians use, and one registry
//     record can cover sub-studies that a curated list splits into several rows.
//   • A confirmed match is only as good as the reviewer who clicked Confirm.
//
// Read the confidence number as "how much reading this saved you", not as a
// probability that the link is correct.
// ---------------------------------------------------------------------------

/** The caveat the review screen should show; kept here so it stays next to the reasoning. */
export const MATCH_CAVEAT =
  'These are search results, not answers. ClinicalTrials.gov search is fuzzy and protocol ' +
  'numbers are not globally unique, so open the record and read it before you confirm. ' +
  'Confirming writes the NCT number onto the trial; nothing else here does.';

/** The TrialTree side of a comparison. Flat on purpose so the route can build it from any query shape. */
export type TrialForMatching = {
  id: string;
  title: string;
  protocolNumber: string | null;
  shorthand: string | null;
  phase: string | null;
  principalInvestigator: string | null;
  /** Site-level PI names TrialTree already holds for this trial. May be empty. */
  sitePiNames: string[];
  /** TrialTree center slugs this trial is listed at. May be empty. */
  centerSlugs: string[];
};

// The base client drops the sponsor/secondary identifiers, which is right for
// the importer (it keys on NCT id) and wrong for us — the protocol-number hit
// is the single highest-value signal we have, and it lives only in those
// fields. So candidates carry a slightly wider shape than CtgovStudy.
export type CtgovCandidate = CtgovStudy & {
  orgStudyId: string | null;
  secondaryIds: string[];
  overallStatus: string | null;
  /** Which of our searches surfaced this record — itself part of the evidence. */
  queries: string[];
};

export type EvidencePoint = { label: string; value: number };

export type MatchEvidence = {
  protocolId: 'EXACT' | 'PARTIAL' | 'NONE';
  /** The identifier on the CT.gov record that matched, verbatim. */
  matchedProtocolId: string | null;
  /** Dice coefficient over distinctive title terms, 0-1, rounded to 2dp. */
  titleSimilarity: number;
  sharedTitleTerms: string[];
  phase: 'AGREE' | 'CONFLICT' | 'UNKNOWN';
  trialPhase: string | null;
  candidatePhase: string | null;
  /** Lowercased surname present on both sides, if any. */
  piSurname: string | null;
  /** Centers on the CT.gov record that TrialTree also lists for this trial. */
  sharedCenters: string[];
  /** Centers on the record that TrialTree does not list for this trial. */
  otherCenters: string[];
  californiaSite: boolean;
  /** True when a rival candidate scored close enough that the search cannot separate them. */
  ambiguous: boolean;
  queries: string[];
  /** The arithmetic, so a reviewer can audit the number instead of trusting it. */
  points: EvidencePoint[];
  rawScore: number;
};

export type ScoredCandidate = {
  nctId: string;
  title: string;
  confidence: number;
  evidence: MatchEvidence;
};

export type CtgovSearchResult = {
  candidates: CtgovCandidate[];
  /** Human labels for the searches actually run. */
  queries: string[];
  /** Non-fatal problems (HTTP errors, timeouts). Search degrades, it never throws. */
  errors: string[];
};

// --- Thresholds ------------------------------------------------------------
//
// These are judgement calls, not measurements, and they are set to fail toward
// silence. Below PROPOSE_MIN_CONFIDENCE we emit nothing at all rather than a
// guess: an empty queue costs a curator a manual search, while a queue full of
// weak proposals trains them to click Confirm without reading, which is the one
// outcome that actually hurts a patient.

/** Below this, produce nothing. 55 is roughly "a strong title match, or an id hit plus one corroborating signal". */
export const PROPOSE_MIN_CONFIDENCE = 55;

/** At or above this the proposal is worth looking at first. It still requires a human click. */
export const STRONG_CONFIDENCE = 80;

/** Two candidates within this many points are treated as indistinguishable. */
export const AMBIGUITY_MARGIN = 8;

/** What indistinguishability costs. Applied to every candidate, so ambiguity can push a whole trial below the floor. */
export const AMBIGUITY_PENALTY = 15;

/** More than a handful of proposals per trial is a search that failed, not a shortlist. */
export const MAX_PROPOSALS_PER_TRIAL = 3;

// --- Scoring weights -------------------------------------------------------
//
// Deterministic and additive so the review screen can print the arithmetic.
// An exact protocol-id hit is weighted heaviest but deliberately kept under
// the propose floor on its own (45 < 55): protocol numbers are reused across
// institutions, so an id hit with nothing else agreeing is exactly the case we
// want to stay quiet about.
const W = {
  PROTOCOL_EXACT: 45,
  PROTOCOL_PARTIAL: 20,
  TITLE_STRONG: 30,
  TITLE_MODERATE: 18,
  TITLE_WEAK: 8,
  PHASE_AGREE: 8,
  PHASE_CONFLICT: -14,
  PI_SURNAME: 12,
  CENTER_SHARED: 12,
  CENTER_OTHER: 6,
  CALIFORNIA_SITE: 3,
  SHORTHAND_HIT: 5,
} as const;

const TITLE_STRONG_AT = 0.7;
const TITLE_MODERATE_AT = 0.5;
const TITLE_WEAK_AT = 0.34;

/** Shorter than this, an identifier is too generic to compare ("21", "A3"). */
const MIN_PROTOCOL_ID_LENGTH = 5;

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

// Registry titles are written to a template ("A Phase 3, Randomized,
// Open-Label Study of ... in Participants With ..."), so the template words
// carry no signal and inflate every similarity score. Strip them and compare
// what is left: agents, populations, disease states.
const TITLE_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'for', 'to', 'with', 'without', 'versus', 'vs',
  'study', 'trial', 'clinical', 'phase', 'randomized', 'randomised', 'open', 'label', 'blind',
  'blinded', 'double', 'single', 'placebo', 'controlled', 'multicenter', 'multicentre', 'multi',
  'center', 'centre', 'arm', 'group', 'cohort', 'part', 'pilot', 'first', 'human', 'dose',
  'escalation', 'expansion', 'safety', 'efficacy', 'tolerability', 'pharmacokinetics',
  'evaluate', 'evaluating', 'evaluation', 'assess', 'assessing', 'assessment', 'investigate',
  'investigating', 'compare', 'comparing', 'comparison', 'determine', 'treatment', 'therapy',
  'patients', 'patient', 'participants', 'subjects', 'adults', 'men', 'women', 'who', 'have',
  'has', 'are', 'is', 'be', 'been', 'their', 'this', 'that', 'plus', 'alone', 'combination',
  'combined', 'sequential', 'prospective', 'retrospective', 'observational', 'interventional',
  'registry', 'protocol', 'nct', 'cancer', 'tumor', 'tumour', 'tumors', 'tumours', 'carcinoma',
  'neoplasm', 'neoplasms', 'disease', 'oncology',
]);

/** Lowercase, drop punctuation, collapse whitespace. "177Lu-PSMA-617" -> "177lu psma 617". */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return squash(text)
    .split(' ')
    .filter((t) => {
      if (!t || TITLE_STOPWORDS.has(t)) return false;
      // Bare short numbers are enrollment counts and dose fragments, not signal;
      // longer digit runs are usually part of a compound code (e.g. "617").
      if (/^\d+$/.test(t)) return t.length >= 4;
      return t.length >= 3;
    });
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Sørensen–Dice over token sets: symmetric, and forgiving of one title being longer. */
function diceSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

function sharedTokens(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const t of a) if (b.has(t)) out.push(t);
  return out.sort().slice(0, 8);
}

/** "COH-21345" and "COH 21345" are the same identifier; compare them as "COH21345". */
function normalizeId(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Pick the terms most likely to identify a study, longest first so the
 * agent name beats the disease word. Deterministic — ties break
 * alphabetically, so the same trial always produces the same CT.gov query.
 */
function distinctiveTerms(text: string, limit: number): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const t of tokenize(text)) {
    if (seen.has(t)) continue;
    seen.add(t);
    terms.push(t);
  }
  terms.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  return terms.slice(0, limit);
}

/** "Phase I/II" and "Phase 1/2" both reduce to [1, 2] so they can be compared. */
function phaseNumbers(label: string | null | undefined): number[] {
  if (!label) return [];
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };
  const tail = label.toLowerCase().replace(/early/g, ' ').replace(/phase/g, ' ');
  const out = new Set<number>();
  for (const part of tail.split(/[^a-z0-9]+/)) {
    if (!part) continue;
    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= 4) out.add(n);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(roman, part)) out.add(roman[part]);
  }
  return Array.from(out).sort((a, b) => a - b);
}

/** Last name, lowercased, from anything cleanPi() accepts as a person. */
function surnameOf(raw: string | null | undefined): string | null {
  const cleaned = cleanPi(raw);
  if (!cleaned) return null;
  const parts = cleaned.split(' ').filter(Boolean);
  const last = parts[parts.length - 1]?.toLowerCase() ?? '';
  return last.length >= 3 ? last : null;
}

function surnameSet(names: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const n of names) {
    const s = surnameOf(n);
    if (s) out.add(s);
  }
  return out;
}

/**
 * Which TrialTree centers appear among a record's California sites.
 *
 * resolveLocationSlug() does substring matching on center aliases, which is
 * fine for real facility strings and wrong for very short ones ("UC" would
 * match UCLA), so require a facility name long enough to be a facility name.
 */
function centersInRecord(locations: CtgovLocation[]): { slugs: string[]; californiaSite: boolean } {
  const slugs = new Set<string>();
  let californiaSite = false;
  for (const loc of locations) {
    if ((loc.state || '').toLowerCase() !== 'california') continue;
    californiaSite = true;
    const facility = loc.facility.toLowerCase().replace(/[.,/]/g, ' ').replace(/\s+/g, ' ').trim();
    if (facility.length < 4) continue;
    const slug = resolveLocationSlug(facility);
    if (slug) slugs.add(slug);
  }
  return { slugs: Array.from(slugs).sort(), californiaSite };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score one CT.gov record against one TrialTree trial. Pure, additive and
 * deterministic: the same inputs always produce the same number, and the
 * `points` array is the number's own audit trail.
 */
export function scoreCandidate(trial: TrialForMatching, candidate: CtgovCandidate): ScoredCandidate {
  const points: EvidencePoint[] = [];

  // --- Protocol / sponsor identifier -------------------------------------
  const recordIds = [candidate.orgStudyId, ...candidate.secondaryIds]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const ours = trial.protocolNumber ? normalizeId(trial.protocolNumber) : '';
  let protocolId: MatchEvidence['protocolId'] = 'NONE';
  let matchedProtocolId: string | null = null;

  if (ours.length >= MIN_PROTOCOL_ID_LENGTH) {
    for (const raw of recordIds) {
      const theirs = normalizeId(raw);
      if (theirs.length < MIN_PROTOCOL_ID_LENGTH) continue;
      if (theirs === ours) {
        protocolId = 'EXACT';
        matchedProtocolId = raw;
        break;
      }
      // Centers append suffixes ("COH-21345-A") and registries drop prefixes,
      // so containment is worth something — far less than equality.
      if (protocolId === 'NONE' && (theirs.includes(ours) || ours.includes(theirs))) {
        protocolId = 'PARTIAL';
        matchedProtocolId = raw;
      }
    }
  }
  if (protocolId === 'EXACT') points.push({ label: 'Protocol number matches an id on the record', value: W.PROTOCOL_EXACT });
  else if (protocolId === 'PARTIAL') points.push({ label: 'Protocol number partly overlaps an id on the record', value: W.PROTOCOL_PARTIAL });

  // --- Title overlap ------------------------------------------------------
  const ourTitleTokens = tokenSet(trial.title);
  const theirTitleTokens = tokenSet(candidate.title);
  const similarity = diceSimilarity(ourTitleTokens, theirTitleTokens);
  const sharedTitleTerms = sharedTokens(ourTitleTokens, theirTitleTokens);
  if (similarity >= TITLE_STRONG_AT) points.push({ label: 'Titles share most distinctive terms', value: W.TITLE_STRONG });
  else if (similarity >= TITLE_MODERATE_AT) points.push({ label: 'Titles share about half their distinctive terms', value: W.TITLE_MODERATE });
  else if (similarity >= TITLE_WEAK_AT) points.push({ label: 'Titles share a few distinctive terms', value: W.TITLE_WEAK });

  // The curated shorthand is usually the agent or the regimen — a direct hit on
  // it is a different signal from title overlap, so it scores separately.
  const shorthandTokens = trial.shorthand ? tokenize(trial.shorthand).filter((t) => t.length >= 4) : [];
  const shorthandHit = shorthandTokens.some((t) => theirTitleTokens.has(t));
  if (shorthandHit) points.push({ label: 'Trial shorthand appears in the record title', value: W.SHORTHAND_HIT });

  // --- Phase --------------------------------------------------------------
  const candidatePhase = formatPhase(candidate.phases);
  const oursPhase = phaseNumbers(trial.phase);
  const theirsPhase = phaseNumbers(candidatePhase);
  let phase: MatchEvidence['phase'] = 'UNKNOWN';
  if (oursPhase.length > 0 && theirsPhase.length > 0) {
    phase = oursPhase.some((n) => theirsPhase.includes(n)) ? 'AGREE' : 'CONFLICT';
  }
  if (phase === 'AGREE') points.push({ label: 'Phase agrees', value: W.PHASE_AGREE });
  else if (phase === 'CONFLICT') points.push({ label: 'Phase disagrees', value: W.PHASE_CONFLICT });

  // --- Investigator -------------------------------------------------------
  const ourSurnames = surnameSet([trial.principalInvestigator, ...trial.sitePiNames]);
  const theirSurnames = surnameSet([candidate.leadPI, ...candidate.locations.map((l) => l.investigator)]);
  let piSurname: string | null = null;
  for (const s of Array.from(ourSurnames).sort()) {
    if (theirSurnames.has(s)) {
      piSurname = s;
      break;
    }
  }
  if (piSurname) points.push({ label: 'An investigator surname appears on both', value: W.PI_SURNAME });

  // --- Geography ----------------------------------------------------------
  const { slugs, californiaSite } = centersInRecord(candidate.locations);
  const ourCenters = new Set(trial.centerSlugs);
  const sharedCenters = slugs.filter((s) => ourCenters.has(s));
  const otherCenters = slugs.filter((s) => !ourCenters.has(s));
  if (sharedCenters.length > 0) points.push({ label: 'Record has a site at a center TrialTree lists for this trial', value: W.CENTER_SHARED });
  else if (otherCenters.length > 0) points.push({ label: 'Record has a site at a TrialTree center', value: W.CENTER_OTHER });
  else if (californiaSite) points.push({ label: 'Record has a California site', value: W.CALIFORNIA_SITE });

  const rawScore = points.reduce((sum, p) => sum + p.value, 0);
  const confidence = clamp(rawScore);

  return {
    nctId: candidate.nctId,
    title: candidate.title,
    confidence,
    evidence: {
      protocolId,
      matchedProtocolId,
      titleSimilarity: Math.round(similarity * 100) / 100,
      sharedTitleTerms,
      phase,
      trialPhase: trial.phase,
      candidatePhase,
      piSurname,
      sharedCenters,
      otherCenters,
      californiaSite,
      ambiguous: false,
      queries: candidate.queries,
      points,
      rawScore,
    },
  };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Score every candidate and rank them, then charge for ambiguity.
 *
 * When the top two are within AMBIGUITY_MARGIN the search has found two studies
 * it cannot tell apart, and picking the higher one would be a coin flip dressed
 * up as a score. So the penalty lands on ALL of them — often dropping the whole
 * trial below the propose floor, which is the correct outcome. The one escape
 * is an exact protocol-id hit that the runner-up does not have: that is a real
 * discriminator rather than a rounding difference.
 */
export function rankCandidates(trial: TrialForMatching, candidates: CtgovCandidate[]): ScoredCandidate[] {
  const scored = candidates
    .filter((c) => c.nctId)
    .map((c) => scoreCandidate(trial, c))
    // Tie-break on NCT id so repeated runs produce a stable order.
    .sort((a, b) => b.confidence - a.confidence || a.nctId.localeCompare(b.nctId));

  if (scored.length < 2) return scored;

  const [top, runnerUp] = scored;
  const disambiguatedById =
    top.evidence.protocolId === 'EXACT' && runnerUp.evidence.protocolId !== 'EXACT';
  if (top.confidence - runnerUp.confidence >= AMBIGUITY_MARGIN || disambiguatedById) return scored;

  return scored.map((c) => ({
    ...c,
    confidence: clamp(c.confidence - AMBIGUITY_PENALTY),
    evidence: {
      ...c.evidence,
      ambiguous: true,
      points: [...c.evidence.points, { label: 'Another candidate scored just as well', value: -AMBIGUITY_PENALTY }],
    },
  }));
}

/**
 * The gate. Returns the candidates a human should look at, or an empty array —
 * which is a normal, expected result and must never be reported as a failure.
 */
export function proposeMatches(trial: TrialForMatching, candidates: CtgovCandidate[]): ScoredCandidate[] {
  return rankCandidates(trial, candidates)
    .filter((c) => c.confidence >= PROPOSE_MIN_CONFIDENCE)
    .slice(0, MAX_PROPOSALS_PER_TRIAL);
}

// ---------------------------------------------------------------------------
// Plain-language evidence
// ---------------------------------------------------------------------------

/** Turn structured evidence into sentences a reviewer can check against the record. */
export function describeEvidence(e: MatchEvidence): string[] {
  const lines: string[] = [];

  if (e.protocolId === 'EXACT') {
    lines.push(
      `The trial's protocol number matches “${e.matchedProtocolId ?? 'an identifier'}” on this record. ` +
        'Protocol numbers are reused across institutions, so confirm the study is actually the same one.',
    );
  } else if (e.protocolId === 'PARTIAL') {
    lines.push(
      `The trial's protocol number partly overlaps “${e.matchedProtocolId ?? 'an identifier'}” on this record — ` +
        'this is often a sub-study or a different site of a related protocol.',
    );
  } else {
    lines.push('No protocol-number match. This proposal rests on the title and the other signals below.');
  }

  const pct = Math.round(e.titleSimilarity * 100);
  if (e.sharedTitleTerms.length > 0) {
    lines.push(`Titles overlap ${pct}% on distinctive terms: ${e.sharedTitleTerms.join(', ')}.`);
  } else {
    lines.push('The titles share no distinctive terms.');
  }

  if (e.phase === 'AGREE') {
    lines.push(`Phase agrees — ${e.trialPhase ?? 'unknown'} on both sides.`);
  } else if (e.phase === 'CONFLICT') {
    lines.push(
      `Phase disagrees — TrialTree has ${e.trialPhase ?? 'unknown'}, the record says ${e.candidatePhase ?? 'unknown'}. ` +
        'That is usually a different study.',
    );
  } else {
    lines.push('Phase could not be compared (one side does not state it).');
  }

  if (e.piSurname) {
    lines.push(`The investigator surname “${e.piSurname}” appears on both sides.`);
  } else {
    lines.push('No investigator surname in common.');
  }

  if (e.sharedCenters.length > 0) {
    lines.push(
      `The record lists a site at ${e.sharedCenters.map(locationLabel).join(', ')}, which TrialTree also lists for this trial.`,
    );
  } else if (e.otherCenters.length > 0) {
    lines.push(
      `The record lists a site at ${e.otherCenters.map(locationLabel).join(', ')}, but not at the center TrialTree has for this trial.`,
    );
  } else if (e.californiaSite) {
    lines.push('The record has a California site, but not at any TrialTree center.');
  } else {
    lines.push('The record lists no California site.');
  }

  if (e.ambiguous) {
    lines.push(
      'Another ClinicalTrials.gov record scored within a few points of this one, so the confidence shown was reduced. ' +
        'The search cannot tell them apart — you have to.',
    );
  }

  if (e.queries.length > 0) {
    lines.push(`Surfaced by: ${e.queries.join('; ')}.`);
  }

  return lines;
}

/**
 * Read evidence back out of the Json column defensively. The shape is ours, but
 * it is stored as untyped JSON and a row may predate a change to the shape, so
 * anything unexpected degrades to null rather than crashing a review screen.
 */
export function coerceEvidence(value: unknown): MatchEvidence | null {
  if (!isRecord(value)) return null;
  const protocolId = oneOf(value.protocolId, ['EXACT', 'PARTIAL', 'NONE'] as const);
  const phase = oneOf(value.phase, ['AGREE', 'CONFLICT', 'UNKNOWN'] as const);
  if (!protocolId || !phase) return null;

  const points: EvidencePoint[] = [];
  for (const p of arr(value.points)) {
    if (isRecord(p) && typeof p.label === 'string' && typeof p.value === 'number') {
      points.push({ label: p.label, value: p.value });
    }
  }

  return {
    protocolId,
    matchedProtocolId: strOrNull(value.matchedProtocolId),
    titleSimilarity: typeof value.titleSimilarity === 'number' ? value.titleSimilarity : 0,
    sharedTitleTerms: strArray(value.sharedTitleTerms),
    phase,
    trialPhase: strOrNull(value.trialPhase),
    candidatePhase: strOrNull(value.candidatePhase),
    piSurname: strOrNull(value.piSurname),
    sharedCenters: strArray(value.sharedCenters),
    otherCenters: strArray(value.otherCenters),
    californiaSite: value.californiaSite === true,
    ambiguous: value.ambiguous === true,
    queries: strArray(value.queries),
    points,
    rawScore: typeof value.rawScore === 'number' ? value.rawScore : 0,
  };
}

// ---------------------------------------------------------------------------
// CT.gov search (narrow queries; client.ts's fetch is condition-wide)
// ---------------------------------------------------------------------------

const API = 'https://clinicaltrials.gov/api/v2/studies';
const PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 12_000;
/** A search returning more than this has not narrowed anything; scoring it is noise. */
const MAX_CANDIDATES = 60;

/** Public CT.gov study URL, for the "check it yourself" link in the review UI. */
export function ctgovStudyUrl(nctId: string): string {
  return `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`;
}

/**
 * Run the narrow searches that could plausibly surface this trial's record.
 *
 * Three queries at most, each aimed at a different failure of the others: the
 * id query catches trials whose sponsor registered the institutional number,
 * the title query catches renamed protocols, and the California term query
 * catches the rest while keeping the result set small. Anything that fails —
 * a 429, a timeout, a malformed body — is collected into `errors` and the run
 * continues with whatever came back. A route handler must never take a throw
 * from a third-party API it does not control.
 */
export async function searchCandidates(trial: TrialForMatching): Promise<CtgovSearchResult> {
  const errors: string[] = [];
  const plans: { label: string; params: Record<string, string> }[] = [];

  const protocolNumber = trial.protocolNumber?.trim() ?? '';
  if (protocolNumber && normalizeId(protocolNumber).length >= MIN_PROTOCOL_ID_LENGTH) {
    plans.push({ label: `protocol-id search for "${protocolNumber}"`, params: { 'query.id': protocolNumber } });
  }

  const titleTerms = distinctiveTerms(trial.title, 3);
  if (titleTerms.length >= 2) {
    plans.push({ label: `title search for "${titleTerms.join(' ')}"`, params: { 'query.titles': titleTerms.join(' ') } });
  }

  // The broad query is the one most likely to drown us, so it is the only one
  // narrowed to California. That costs recall for a record whose CA site is not
  // yet registered — an acceptable trade, since a missed proposal just means a
  // curator searches by hand, while a flood of near-misses erodes review.
  const termSeed = distinctiveTerms(`${trial.shorthand ?? ''} ${trial.title}`, 4);
  if (termSeed.length >= 2) {
    plans.push({
      label: `California search for "${termSeed.join(' ')}"`,
      params: { 'query.term': termSeed.join(' '), 'query.locn': 'California' },
    });
  }

  if (plans.length === 0) {
    return { candidates: [], queries: [], errors: ['Not enough identifying text on this trial to search ClinicalTrials.gov.'] };
  }

  const byNctId = new Map<string, CtgovCandidate>();
  for (const plan of plans) {
    const found = await runQuery(plan.params, plan.label, errors);
    for (const study of found) {
      if (!study.nctId) continue;
      const existing = byNctId.get(study.nctId);
      if (existing) {
        // Appearing in more than one search is worth recording, even though it
        // does not score: it tells the reviewer how the record was reached.
        if (!existing.queries.includes(plan.label)) existing.queries.push(plan.label);
        continue;
      }
      if (byNctId.size >= MAX_CANDIDATES) break;
      byNctId.set(study.nctId, study);
    }
  }

  return { candidates: Array.from(byNctId.values()), queries: plans.map((p) => p.label), errors };
}

async function runQuery(
  params: Record<string, string>,
  label: string,
  errors: string[],
): Promise<CtgovCandidate[]> {
  const url = new URL(API);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('pageSize', String(PAGE_SIZE));

  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      errors.push(`${label}: ClinicalTrials.gov returned ${res.status}`);
      return [];
    }
    const json: unknown = await res.json();
    const studies = isRecord(json) ? arr(json.studies) : [];
    return studies.map((s) => normalizeCandidate(s, label));
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'network error';
    errors.push(`${label}: ${reason}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Same walk as client.ts's private normalize(), widened to keep the sponsor and
 * secondary identifiers. Duplicated rather than exported from there because the
 * importer has no use for those fields and this module is the only caller that
 * needs an unknown-safe reader for them.
 */
function normalizeCandidate(raw: unknown, query: string): CtgovCandidate {
  const ps = rec(rec(raw).protocolSection);
  const idm = rec(ps.identificationModule);
  const design = rec(ps.designModule);
  const conditions = rec(ps.conditionsModule);
  const eligibility = rec(ps.eligibilityModule);
  const contacts = rec(ps.contactsLocationsModule);
  const status = rec(ps.statusModule);
  const officials = arr(contacts.overallOfficials).map(rec);

  const secondaryIds: string[] = [];
  for (const entry of arr(idm.secondaryIdInfos)) {
    const id = strOrNull(rec(entry).id);
    if (id) secondaryIds.push(id);
  }

  const leadOfficial: Record<string, unknown> | undefined =
    officials.find((o) => /principal investigator|study chair|study director/i.test(str(o.role))) ?? officials[0];

  return {
    nctId: str(idm.nctId),
    title: strOrNull(idm.briefTitle) ?? strOrNull(idm.officialTitle) ?? 'Untitled study',
    phases: strArray(design.phases),
    conditions: strArray(conditions.conditions),
    eligibility: strOrNull(eligibility.eligibilityCriteria),
    leadPI: leadOfficial ? strOrNull(leadOfficial.name) : null,
    locations: arr(contacts.locations).map((entry) => {
      const l = rec(entry);
      const siteContacts = arr(l.contacts).map(rec);
      const investigator =
        strOrNull(siteContacts.find((c) => /principal.investigator/i.test(str(c.role)))?.name) ??
        strOrNull(siteContacts.find((c) => /sub.investigator/i.test(str(c.role)))?.name) ??
        null;
      return {
        facility: str(l.facility),
        city: str(l.city),
        state: str(l.state),
        status: str(l.status),
        investigator,
      };
    }),
    orgStudyId: strOrNull(rec(idm.orgStudyIdInfo).id),
    secondaryIds,
    overallStatus: strOrNull(status.overallStatus),
    queries: [query],
  };
}

// --- unknown-safe readers --------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function rec(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function strArray(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === 'string');
}

/** Narrow an unknown to one of a fixed set of string literals, or null. */
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  if (typeof v !== 'string') return null;
  const hit = allowed.find((a) => a === v);
  return hit ?? null;
}
