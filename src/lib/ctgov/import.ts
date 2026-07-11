import type { PrismaClient } from '@prisma/client';
import { CENTERS } from '@/lib/locations';
import { publishTreeUpdate } from '@/lib/events';
import {
  fetchStudiesByCondition,
  formatPhase,
  mapLocationStatus,
  type CtgovStudy,
} from './client';

// ---------------------------------------------------------------------------
// Import real GU oncology trials from ClinicalTrials.gov into the tree.
//
// Coexistence with text edits: trials are upserted by NCT id; a TrialLocation
// that a clinician has changed by text (manualOverride = true) is left alone —
// only its lastSyncedAt is bumped. So CT.gov provides the baseline, and human
// edits survive every re-sync.
// ---------------------------------------------------------------------------

type Branch = {
  slug: string;
  typeLabel: string;
  condition: string; // ClinicalTrials.gov condition query
  classifyState: (text: string) => string;
  biomarker?: (text: string) => string | null;
};

const BRANCHES: Branch[] = [
  {
    slug: 'prostate',
    typeLabel: 'Prostate Cancer',
    condition: 'prostate cancer',
    classifyState: (t) => {
      if (/castration.?resistant|crpc/.test(t)) return 'Metastatic CRPC (mCRPC)';
      if (/hormone.?sensitive|castration.?sensitive|mhspc|mcspc/.test(t)) return 'Metastatic Hormone-Sensitive';
      if (/biochemical/.test(t)) return 'Biochemical Recurrence';
      if (/metastatic|advanced/.test(t)) return 'Metastatic';
      if (/localized|low.risk|intermediate.risk|high.risk/.test(t)) return 'Localized';
      return 'Other / unspecified';
    },
    biomarker: (t) => {
      if (/brca|hrr|homologous recombination/.test(t)) return 'HRR / BRCA-mutated';
      if (/psma/.test(t)) return 'PSMA-targeted';
      return null;
    },
  },
  {
    slug: 'bladder',
    typeLabel: 'Bladder Cancer',
    condition: 'bladder cancer OR urothelial carcinoma',
    classifyState: (t) => {
      if (/non.?muscle.?invasive|nmibc|bcg/.test(t)) return 'Non-Muscle-Invasive (NMIBC)';
      if (/muscle.?invasive|mibc/.test(t)) return 'Muscle-Invasive (MIBC)';
      if (/metastatic|advanced/.test(t)) return 'Metastatic / Advanced';
      return 'Other / unspecified';
    },
  },
  {
    slug: 'renal',
    typeLabel: 'Renal Cell Carcinoma',
    condition: 'renal cell carcinoma OR kidney cancer',
    classifyState: (t) => {
      if (/non.?clear|papillary|chromophobe/.test(t)) return 'Non-clear-cell';
      if (/clear.?cell|ccrcc/.test(t)) return 'Clear-cell';
      if (/adjuvant/.test(t)) return 'Adjuvant';
      if (/metastatic|advanced/.test(t)) return 'Metastatic / Advanced';
      return 'Other / unspecified';
    },
  },
];

/** Match a CT.gov facility to one of our SoCal centers, else null. */
function matchCenterSlug(facility: string, state: string): string | null {
  if (state && state.toLowerCase() !== 'california') return null;
  const f = facility.toLowerCase();
  for (const c of CENTERS) {
    if (c.aliases.some((a) => f.includes(a))) return c.slug;
  }
  return null;
}

export type ImportSummary = {
  fetched: number;
  matchedSoCal: number;
  created: number;
  updated: number;
  siteRowsWritten: number;
  siteRowsPreserved: number; // manual overrides left untouched
  perDisease: Record<string, number>;
};

export async function importFromCtgov(prisma: PrismaClient): Promise<ImportSummary> {
  const summary: ImportSummary = {
    fetched: 0,
    matchedSoCal: 0,
    created: 0,
    updated: 0,
    siteRowsWritten: 0,
    siteRowsPreserved: 0,
    perDisease: {},
  };

  // Make sure the 5 SoCal centers exist as Location rows.
  const locationIds: Record<string, string> = {};
  for (const c of CENTERS) {
    const loc = await prisma.location.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, name: c.name, shortName: c.shortName },
    });
    locationIds[c.slug] = loc.id;
  }

  const ensureNode = async (
    label: string,
    kind: 'DISEASE_TYPE' | 'DISEASE_STATE' | 'BIOMARKER',
    parentId: string | null,
  ) => {
    const found = await prisma.decisionNode.findFirst({ where: { label, kind, parentId } });
    return found ?? prisma.decisionNode.create({ data: { label, kind, parentId } });
  };

  for (const branch of BRANCHES) {
    const studies = await fetchStudiesByCondition(branch.condition);
    summary.fetched += studies.length;
    const typeNode = await ensureNode(branch.typeLabel, 'DISEASE_TYPE', null);
    let diseaseCount = 0;

    for (const study of studies) {
      if (!study.nctId) continue;

      // Which of our centers is this trial at, and with what status?
      const sites = new Map<string, string>(); // slug -> ctgov site status
      for (const loc of study.locations) {
        const slug = matchCenterSlug(loc.facility, loc.state);
        if (slug && !sites.has(slug)) sites.set(slug, loc.status);
      }
      if (sites.size === 0) continue; // not at a SoCal center we track
      summary.matchedSoCal += 1;
      diseaseCount += 1;

      // Classify into the tree.
      const text = `${study.title} ${study.conditions.join(' ')}`.toLowerCase();
      const stateNode = await ensureNode(branch.classifyState(text), 'DISEASE_STATE', typeNode.id);
      let parentId = stateNode.id;
      const bm = branch.biomarker?.(text) ?? null;
      if (bm) parentId = (await ensureNode(bm, 'BIOMARKER', stateNode.id)).id;

      // Upsert the trial by NCT id.
      const existing = await prisma.trial.findUnique({ where: { nctId: study.nctId } });
      const base = {
        title: study.title,
        phase: formatPhase(study.phases),
        principalInvestigator: study.leadPI,
        decisionNodeId: parentId,
        source: 'CTGOV',
        lastSyncedAt: new Date(),
      };

      let trialId: string;
      if (!existing) {
        const created = await prisma.trial.create({
          data: { ...base, nctId: study.nctId, eligibilityCriteria: trimCriteria(study.eligibility) },
        });
        trialId = created.id;
        summary.created += 1;
      } else {
        const updated = await prisma.trial.update({
          where: { id: existing.id },
          // Don't clobber criteria a clinician edited by text.
          data: existing.criteriaOverride
            ? base
            : { ...base, eligibilityCriteria: trimCriteria(study.eligibility) },
        });
        trialId = updated.id;
        summary.updated += 1;
      }

      // Upsert each site's status, preserving manual overrides.
      for (const [slug, siteStatus] of sites) {
        const locationId = locationIds[slug];
        const existingTL = await prisma.trialLocation.findUnique({
          where: { trialId_locationId: { trialId, locationId } },
        });
        if (existingTL?.manualOverride) {
          await prisma.trialLocation.update({
            where: { id: existingTL.id },
            data: { lastSyncedAt: new Date() },
          });
          summary.siteRowsPreserved += 1;
          continue;
        }
        await prisma.trialLocation.upsert({
          where: { trialId_locationId: { trialId, locationId } },
          update: { status: mapLocationStatus(siteStatus), source: 'CTGOV', lastSyncedAt: new Date() },
          create: {
            trialId,
            locationId,
            status: mapLocationStatus(siteStatus),
            piName: study.leadPI,
            source: 'CTGOV',
            lastSyncedAt: new Date(),
          },
        });
        summary.siteRowsWritten += 1;
      }
    }
    summary.perDisease[branch.typeLabel] = diseaseCount;
  }

  // Tell every open kiosk/admin to refetch and redraw.
  publishTreeUpdate({
    location: 'all',
    action: 'CTGOV_IMPORT',
    summary: `Synced ${summary.created + summary.updated} trials from ClinicalTrials.gov`,
  });

  return summary;
}

// CT.gov eligibility blocks can be huge; keep a readable excerpt.
function trimCriteria(text: string | null): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 600 ? clean.slice(0, 597) + '…' : clean;
}

// Convenience for a study preview (used in tests/debugging).
export type { CtgovStudy };
