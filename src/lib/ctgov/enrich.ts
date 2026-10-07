import { Prisma, type PrismaClient } from '@prisma/client';
import type { CtgovOfficialDTO } from '@/types';
import {
  MAX_PROPOSALS_PER_TRIAL,
  PROPOSE_MIN_CONFIDENCE,
  rankCandidates,
  searchCandidates,
  type ScoredCandidate,
  type TrialForMatching,
} from './match';

// ---------------------------------------------------------------------------
// NCT enrichment: the server-side job that keeps each trial's
// ClinicalTrials.gov link and registry facts current. There is no UI.
// /api/dev/curate runs it after every reload; /api/dev/enrich runs it on
// demand and serves the curator's verification list.
//
// Two steps, in this order:
//   1. matchMissingNcts: search ClinicalTrials.gov for trials the centers
//      listed without an NCT. A link is written automatically ONLY on an
//      exact, unambiguous protocol-identifier match with no phase conflict.
//      Anything weaker becomes PROPOSED NctMatchCandidate rows for a human to
//      verify. A wrong link puts another study's eligibility and contacts in
//      front of a patient, so the bar is a shared identifier, never a title.
//   2. refreshCtgovMetadata: copy overall status, lead sponsor and overall
//      officials from each linked record. Copied as registered (only the role
//      enum is turned into words), never inferred, and stamped with when we
//      asked.
//
// A slow or failing registry never throws out of this job: it becomes a line
// in `errors`, and the rows it would have touched stay exactly as they were.
// ---------------------------------------------------------------------------

const API = 'https://clinicaltrials.gov/api/v2/studies';
/** Twenty ids per request: one failed response then costs at most twenty rows a refresh. */
const BATCH_SIZE = 20;
const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_BUDGET_MS = 90_000;

// The API rejects short paths ("identificationModule.nctId") with a 400; it
// wants the full protocolSection path. Asking for four fields keeps a batch
// of twenty records small.
const FIELDS = [
  'protocolSection.identificationModule.nctId',
  'protocolSection.statusModule.overallStatus',
  'protocolSection.sponsorCollaboratorsModule.leadSponsor',
  'protocolSection.contactsLocationsModule.overallOfficials',
].join(',');

/** One malformed id makes CT.gov reject the whole batch, so ids are checked before they are sent. */
const NCT_PATTERN = /^NCT\d{8}$/;

export type EnrichmentResult = {
  /** Trials that gained an NCT on an exact identifier match. */
  matched: { title: string; nctId: string; note: string }[];
  /** Trials with PROPOSED candidates awaiting a curator. */
  flagged: { title: string; candidates: { nctId: string; confidence: number }[] }[];
  /** Trials searched with nothing worth proposing. A normal outcome, not a failure. */
  unmatched: string[];
  /** Trials whose registry facts were written this run. */
  refreshed: number;
  errors: string[];
  /** Work not started because the time budget ran out. */
  skipped: string[];
};

export type MatchRunResult = Pick<EnrichmentResult, 'matched' | 'flagged' | 'unmatched' | 'errors' | 'skipped'>;
export type RefreshRunResult = Pick<EnrichmentResult, 'refreshed' | 'errors' | 'skipped'>;

/**
 * A wall-clock deadline (ms since epoch). It is a soft cap: no new request
 * starts after it, but one already in flight is allowed to finish, so a run
 * can overshoot by one request (or one trial's three searches).
 */
export type RunOptions = { deadline?: number };

// ---------------------------------------------------------------------------
// The whole job
// ---------------------------------------------------------------------------

/**
 * Match first, then refresh, so a trial linked in step 1 picks up its
 * registry facts in step 2 of the same run. Each step is fenced off: a
 * database failure in one is recorded and the other still runs.
 */
export async function enrichAll(
  prisma: PrismaClient,
  { budgetMs = DEFAULT_BUDGET_MS }: { budgetMs?: number } = {},
): Promise<EnrichmentResult> {
  const budget = Number.isFinite(budgetMs) ? Math.max(0, budgetMs) : DEFAULT_BUDGET_MS;
  const deadline = Date.now() + budget;
  const result: EnrichmentResult = { matched: [], flagged: [], unmatched: [], refreshed: 0, errors: [], skipped: [] };

  try {
    const m = await matchMissingNcts(prisma, { deadline });
    result.matched = m.matched;
    result.flagged = m.flagged;
    result.unmatched = m.unmatched;
    result.errors.push(...m.errors);
    result.skipped.push(...m.skipped);
  } catch (e) {
    result.errors.push(`NCT matching stopped: ${message(e)}`);
  }

  try {
    const r = await refreshCtgovMetadata(prisma, { deadline });
    result.refreshed = r.refreshed;
    result.errors.push(...r.errors);
    result.skipped.push(...r.skipped);
  } catch (e) {
    result.errors.push(`Registry refresh stopped: ${message(e)}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 1: find NCT numbers for trials that have none
// ---------------------------------------------------------------------------

/**
 * One trial at a time, in series, to stay polite to a public API (each trial
 * is up to three searches). Every failure is recorded against the trial and
 * the loop moves on.
 */
export async function matchMissingNcts(prisma: PrismaClient, opts: RunOptions = {}): Promise<MatchRunResult> {
  const result: MatchRunResult = { matched: [], flagged: [], unmatched: [], errors: [], skipped: [] };

  const trials = await prisma.trial.findMany({
    where: { nctId: null },
    orderBy: [{ createdAt: 'asc' }, { title: 'asc' }],
    include: { locations: { include: { location: true } } },
  });

  for (let i = 0; i < trials.length; i++) {
    const trial = trials[i];
    if (pastDeadline(opts.deadline)) {
      for (const rest of trials.slice(i)) {
        result.skipped.push(`NCT search not run for "${short(rest.title)}" (time budget reached)`);
      }
      break;
    }

    const input: TrialForMatching = {
      id: trial.id,
      title: trial.title,
      protocolNumber: trial.protocolNumber,
      shorthand: trial.shorthand,
      phase: trial.phase,
      principalInvestigator: trial.principalInvestigator,
      sitePiNames: trial.locations
        .map((l) => l.piName)
        .filter((n): n is string => typeof n === 'string' && n.length > 0),
      centerSlugs: trial.locations.map((l) => l.location.slug),
    };

    try {
      await matchOne(prisma, input, result);
    } catch (e) {
      result.errors.push(`${short(trial.title)}: ${message(e)}`);
    }
  }

  return result;
}

async function matchOne(prisma: PrismaClient, trial: TrialForMatching, result: MatchRunResult): Promise<void> {
  // searchCandidates never throws; its HTTP and timeout failures come back here.
  const search = await searchCandidates(trial);
  for (const err of search.errors) result.errors.push(`${short(trial.title)}: ${err}`);

  const ranked = rankCandidates(trial, search.candidates);

  const auto = await autoMatchFor(prisma, trial.id, ranked);
  if (auto) {
    // Just the identifier: the panel words it ("Matched automatically on protocol ID …").
    const note = `protocol ID ${auto.matchedProtocolId}`;
    try {
      // nctId: null in the filter so a trial linked by someone else meanwhile is never overwritten.
      const { count } = await prisma.trial.updateMany({
        where: { id: trial.id, nctId: null },
        data: { nctId: auto.nctId, nctSource: 'AUTO_MATCHED', nctMatchNote: note },
      });
      if (count === 1) {
        result.matched.push({ title: trial.title, nctId: auto.nctId, note });
        return;
      }
      result.skipped.push(`"${short(trial.title)}" changed during the run; it will be matched next time`);
      return;
    } catch (e) {
      // Another trial took this NCT between the check and the write. One NCT,
      // one trial: fall through and let a human look at it instead.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    }
  }

  // Not safe to link automatically: record proposals for a human to verify.
  // An exact identifier hit is kept even below the usual floor; it failed the
  // automatic gate, but it is still the best lead a curator has.
  const proposals = ranked
    .filter((c) => c.confidence >= PROPOSE_MIN_CONFIDENCE || c.evidence.protocolId === 'EXACT')
    .slice(0, MAX_PROPOSALS_PER_TRIAL);
  const kept: { nctId: string; confidence: number }[] = [];

  for (const p of proposals) {
    // A candidate a curator already confirmed or rejected stays exactly as
    // they left it; re-proposing it would make the queue argue with them.
    const existing = await prisma.nctMatchCandidate.findUnique({
      where: { trialId_nctId: { trialId: trial.id, nctId: p.nctId } },
      select: { status: true },
    });
    if (existing && existing.status !== 'PROPOSED') continue;

    const evidence = p.evidence as unknown as Prisma.InputJsonValue;
    await prisma.nctMatchCandidate.upsert({
      where: { trialId_nctId: { trialId: trial.id, nctId: p.nctId } },
      create: {
        trialId: trial.id,
        nctId: p.nctId,
        candidateTitle: p.title,
        confidence: p.confidence,
        evidence,
        status: 'PROPOSED',
      },
      update: { candidateTitle: p.title, confidence: p.confidence, evidence },
    });
    kept.push({ nctId: p.nctId, confidence: p.confidence });
  }

  if (kept.length > 0) result.flagged.push({ title: trial.title, candidates: kept });
  else result.unmatched.push(trial.title);
}

/**
 * The auto-link gate. Every condition has to hold, and each one is a way an
 * identifier match can still be wrong:
 *   • the top record carries this trial's protocol number exactly;
 *   • it is the ONLY record that does (protocol numbers are reused across
 *     institutions, so two exact hits means the id is not telling them apart);
 *   • the ranking did not mark it ambiguous, and its phase does not conflict;
 *   • no other trial already holds that NCT (nctId is unique);
 *   • a curator has not already rejected this record for this trial.
 */
async function autoMatchFor(
  prisma: PrismaClient,
  trialId: string,
  ranked: ScoredCandidate[],
): Promise<{ nctId: string; matchedProtocolId: string } | null> {
  const top = ranked.length > 0 ? ranked[0] : null;
  if (!top) return null;

  const e = top.evidence;
  const matchedProtocolId = e.matchedProtocolId;
  if (e.protocolId !== 'EXACT' || e.ambiguous || e.phase === 'CONFLICT' || !matchedProtocolId) return null;
  if (!NCT_PATTERN.test(top.nctId)) return null;
  if (ranked.filter((c) => c.evidence.protocolId === 'EXACT').length > 1) return null;
  // Protocol numbers are reused across institutions, which is why match.ts
  // keeps an exact id hit on its own below even the proposal floor. So the
  // identifier must be corroborated by something independent of it: one of
  // our centers on the record, the same PI, or a clearly similar title.
  if (!(e.sharedCenters.length > 0 || e.piSurname !== null || e.titleSimilarity >= 0.5)) return null;

  const holder = await prisma.trial.findUnique({ where: { nctId: top.nctId }, select: { id: true } });
  if (holder && holder.id !== trialId) return null;

  const decided = await prisma.nctMatchCandidate.findUnique({
    where: { trialId_nctId: { trialId, nctId: top.nctId } },
    select: { status: true },
  });
  if (decided && decided.status === 'REJECTED') return null;

  return { nctId: top.nctId, matchedProtocolId };
}

// ---------------------------------------------------------------------------
// Step 2: copy registry facts for every linked trial
// ---------------------------------------------------------------------------

type RegistryFacts = {
  overallStatus: string | null;
  sponsor: string | null;
  officials: CtgovOfficialDTO[];
};

type BatchFetch = { ok: true; records: Map<string, RegistryFacts> } | { ok: false; error: string };

/**
 * Batches of at most twenty ids. A batch that fails (HTTP error, timeout,
 * unreadable body) writes nothing and is recorded; an id the registry does
 * not return is recorded too, since it usually means a mistyped NCT in the
 * curated file. Each batch's writes go in one transaction.
 */
export async function refreshCtgovMetadata(prisma: PrismaClient, opts: RunOptions = {}): Promise<RefreshRunResult> {
  const result: RefreshRunResult = { refreshed: 0, errors: [], skipped: [] };

  const trials = await prisma.trial.findMany({
    where: { nctId: { not: null } },
    select: { id: true, nctId: true },
    orderBy: { nctId: 'asc' },
  });

  // Registry NCT -> trial id. nctId is unique, so this is one-to-one.
  const trialByNct = new Map<string, string>();
  for (const t of trials) {
    if (!t.nctId) continue;
    const nct = t.nctId.trim().toUpperCase();
    if (!NCT_PATTERN.test(nct)) {
      result.errors.push(`${t.nctId}: not a valid NCT number, so it was not looked up`);
      continue;
    }
    trialByNct.set(nct, t.id);
  }

  const ids = Array.from(trialByNct.keys());
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    if (pastDeadline(opts.deadline)) {
      result.skipped.push(`Registry facts not refreshed for ${ids.slice(i).join(', ')} (time budget reached)`);
      break;
    }

    const batch = ids.slice(i, i + BATCH_SIZE);
    const fetched = await fetchBatch(batch);
    if (!fetched.ok) {
      result.errors.push(`Registry refresh for ${batch.join(', ')}: ${fetched.error}`);
      continue;
    }

    const writes: { trialId: string; facts: RegistryFacts }[] = [];
    for (const nct of batch) {
      const trialId = trialByNct.get(nct);
      const facts = fetched.records.get(nct);
      if (!trialId) continue;
      if (!facts) {
        result.errors.push(`${nct}: not returned by ClinicalTrials.gov; check the number`);
        continue;
      }
      writes.push({ trialId, facts });
    }
    if (writes.length === 0) continue;

    const checkedAt = new Date();
    try {
      result.refreshed += await prisma.$transaction(
        async (tx) => {
          let count = 0;
          for (const w of writes) {
            // updateMany, not update: a trial removed by a reload mid-run is
            // a zero count, not a thrown error that loses the whole batch.
            const res = await tx.trial.updateMany({
              where: { id: w.trialId },
              data: {
                ctgovStatus: w.facts.overallStatus,
                ctgovSponsor: w.facts.sponsor,
                ctgovOfficials: w.facts.officials as unknown as Prisma.InputJsonValue,
                ctgovCheckedAt: checkedAt,
              },
            });
            count += res.count;
          }
          return count;
        },
        { timeout: 30_000, maxWait: 10_000 },
      );
    } catch (e) {
      result.errors.push(`Registry refresh for ${batch.join(', ')}: could not save (${message(e)})`);
    }
  }

  return result;
}

async function fetchBatch(ids: string[]): Promise<BatchFetch> {
  const url = new URL(API);
  url.searchParams.set('filter.ids', ids.join(','));
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('pageSize', String(Math.max(ids.length, BATCH_SIZE)));

  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `ClinicalTrials.gov returned ${res.status}` };

    const json: unknown = await res.json();
    const records = new Map<string, RegistryFacts>();
    for (const study of arr(rec(json).studies)) {
      const ps = rec(rec(study).protocolSection);
      const nct = text(rec(ps.identificationModule).nctId);
      if (!nct) continue;
      records.set(nct.toUpperCase(), {
        overallStatus: text(rec(ps.statusModule).overallStatus),
        sponsor: text(rec(rec(ps.sponsorCollaboratorsModule).leadSponsor).name),
        officials: officialsFromRecord(rec(ps.contactsLocationsModule).overallOfficials),
      });
    }
    return { ok: true, records };
  } catch (e) {
    if (controller.signal.aborted) return { ok: false, error: `no response within ${REQUEST_TIMEOUT_MS / 1000}s` };
    return { ok: false, error: message(e) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Officials: written from the registry, read back from the Json column
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  PRINCIPAL_INVESTIGATOR: 'Principal Investigator',
  STUDY_CHAIR: 'Study Chair',
  STUDY_DIRECTOR: 'Study Director',
};

/** "PRINCIPAL_INVESTIGATOR" -> "Principal Investigator"; an unknown enum is title-cased, not guessed at. */
export function humaniseRole(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (!key) return null;
  const known = ROLE_LABELS[key];
  if (known) return known;
  return key
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Names are kept exactly as registered, credentials and all. */
function officialsFromRecord(raw: unknown): CtgovOfficialDTO[] {
  const out: CtgovOfficialDTO[] = [];
  for (const entry of arr(raw)) {
    const o = rec(entry);
    const name = text(o.name);
    if (!name) continue;
    out.push({ name, role: humaniseRole(text(o.role)), affiliation: text(o.affiliation) });
  }
  return out;
}

/**
 * Read stored officials back out of the Json column for /api/tree. The column
 * is untyped and a row may predate a change to the shape, so a malformed entry
 * is dropped rather than trusted, and anything that is not a list reads as none.
 */
export function coerceOfficials(value: unknown): CtgovOfficialDTO[] {
  const out: CtgovOfficialDTO[] = [];
  for (const entry of arr(value)) {
    if (!isRecord(entry)) continue;
    const name = text(entry.name);
    if (!name) continue;
    out.push({ name, role: text(entry.role), affiliation: text(entry.affiliation) });
  }
  return out;
}

// --- helpers ---------------------------------------------------------------

function pastDeadline(deadline: number | undefined): boolean {
  return deadline !== undefined && Date.now() >= deadline;
}

function short(title: string): string {
  return title.length > 70 ? `${title.slice(0, 67)}...` : title;
}

/** First line only: Prisma messages run to many lines and can echo the query. */
function message(e: unknown): string {
  const raw = e instanceof Error && e.message ? e.message : 'unknown error';
  const line = raw.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? 'unknown error';
  return line.length > 200 ? `${line.slice(0, 197)}...` : line;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function rec(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** A trimmed, non-empty string, or null. */
function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
