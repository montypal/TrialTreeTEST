// Thin client for the ClinicalTrials.gov v2 REST API (https://clinicaltrials.gov/data-api).
// No API key required. We fetch currently-recruiting trials for a condition,
// narrowed to California, and normalize the deeply-nested response into a flat
// shape the importer can work with.

export type CtgovLocation = { facility: string; city: string; state: string; status: string };
export type CtgovStudy = {
  nctId: string;
  title: string;
  phases: string[];
  conditions: string[];
  eligibility: string | null;
  leadPI: string | null;
  locations: CtgovLocation[];
};

const API = 'https://clinicaltrials.gov/api/v2/studies';

export async function fetchStudiesByCondition(condition: string, maxPages = 2): Promise<CtgovStudy[]> {
  const out: CtgovStudy[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(API);
    url.searchParams.set('query.cond', condition);
    url.searchParams.set('query.locn', 'California');
    url.searchParams.set('filter.overallStatus', 'RECRUITING');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ClinicalTrials.gov ${res.status}: ${body.slice(0, 180)}`);
    }
    const json = (await res.json()) as { studies?: unknown[]; nextPageToken?: string };
    for (const s of json.studies ?? []) out.push(normalize(s));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(study: any): CtgovStudy {
  const ps = study?.protocolSection ?? {};
  const id = ps.identificationModule ?? {};
  const design = ps.designModule ?? {};
  const conditions = ps.conditionsModule ?? {};
  const elig = ps.eligibilityModule ?? {};
  const cl = ps.contactsLocationsModule ?? {};
  const officials: any[] = cl.overallOfficials ?? [];

  return {
    nctId: id.nctId ?? '',
    title: id.briefTitle ?? id.officialTitle ?? 'Untitled study',
    phases: design.phases ?? [],
    conditions: conditions.conditions ?? [],
    eligibility: elig.eligibilityCriteria ?? null,
    leadPI: officials.find((o) => /principal investigator|study chair|study director/i.test(o?.role ?? ''))?.name ?? officials[0]?.name ?? null,
    locations: (cl.locations ?? []).map((l: any) => ({
      facility: l.facility ?? '',
      city: l.city ?? '',
      state: l.state ?? '',
      status: l.status ?? '',
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** CT.gov phase enums -> human label, e.g. ["PHASE1","PHASE2"] -> "Phase I/II". */
export function formatPhase(phases: string[]): string | null {
  const map: Record<string, string> = {
    EARLY_PHASE1: 'Early Phase I',
    PHASE1: 'Phase I',
    PHASE2: 'Phase II',
    PHASE3: 'Phase III',
    PHASE4: 'Phase IV',
  };
  const named = phases.filter((p) => p && p !== 'NA').map((p) => map[p] ?? p);
  if (named.length === 0) return null;
  if (named.length === 1) return named[0];
  return 'Phase ' + named.map((n) => n.replace('Phase ', '')).join('/');
}

/** CT.gov per-site status -> our RecruitmentStatus. */
export function mapLocationStatus(s: string): 'RECRUITING' | 'WAITLISTED' | 'CLOSED' | 'SUSPENDED' {
  switch (s) {
    case 'RECRUITING':
    case 'ENROLLING_BY_INVITATION':
      return 'RECRUITING';
    case 'NOT_YET_RECRUITING':
      return 'WAITLISTED';
    case 'SUSPENDED':
      return 'SUSPENDED';
    default:
      return 'CLOSED'; // ACTIVE_NOT_RECRUITING, COMPLETED, TERMINATED, WITHDRAWN
  }
}
