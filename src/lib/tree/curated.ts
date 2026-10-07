import type { PrismaClient } from '@prisma/client';
import { CENTERS, locationLabel } from '../locations';
import { CURATED_TREES, type CuratedNode, type CuratedTrial } from './curatedData';

// ---------------------------------------------------------------------------
// Load the human-curated trees + trials (src/lib/tree/curatedData.ts) into the
// database. The data file is the source of truth, so a reload is a clean
// rebuild: every existing trial and decision node is removed, then the curated
// ones are recreated.
//
// It runs in a single transaction — if anything fails part-way, nothing
// changes and the previous data stays live.
//
// Known limitation: a reload also resets any status a clinician changed by
// text/email since the last reload. (SMS isn't live yet; revisit before it is.)
// It also drops what the enrichment job added (auto-matched NCTs, registry
// facts, proposed matches), which is why /api/dev/curate re-runs that job
// (src/lib/ctgov/enrich.ts) straight after every reload.
// ---------------------------------------------------------------------------

export type ReloadSummary = {
  trials: number;
  siteLinks: number;
  nodes: number;
  centers: number;
  perTree: Record<string, number>;
};

/** Text shown in the trial panel and fed to the AI matcher. */
function trialText(t: CuratedTrial): string | null {
  const parts: string[] = [];
  if (t.setting) parts.push(`Setting: ${t.setting}.`);
  if (t.summary) parts.push(t.summary);
  const notes = t.sites.filter((s) => s.notes).map((s) => `• ${locationLabel(s.center)}: ${s.notes}`);
  if (notes.length) parts.push(`Site notes:\n${notes.join('\n')}`);
  return parts.length ? parts.join('\n\n') : null;
}

export async function reloadCuratedData(prisma: PrismaClient): Promise<ReloadSummary> {
  return prisma.$transaction(
    async (tx) => {
      // Make sure every center exists (and picks up renamed display names).
      const locationIds: Record<string, string> = {};
      for (const c of CENTERS) {
        const loc = await tx.location.upsert({
          where: { slug: c.slug },
          update: { name: c.name, shortName: c.shortName },
          create: { slug: c.slug, name: c.name, shortName: c.shortName },
        });
        locationIds[c.slug] = loc.id;
      }

      // Clean slate. Trials cascade to their site links + cohorts; decision
      // nodes are self-referencing with cascade, so one delete clears the tree.
      await tx.trial.deleteMany({});
      await tx.decisionNode.deleteMany({});

      const summary: ReloadSummary = {
        trials: 0,
        siteLinks: 0,
        nodes: 0,
        centers: CENTERS.length,
        perTree: {},
      };

      const build = async (node: CuratedNode, parentId: string | null, sortOrder: number, tree: string) => {
        const created = await tx.decisionNode.create({
          data: { label: node.label, kind: node.kind, parentId, notes: node.tag, sortOrder },
        });
        summary.nodes += 1;

        for (const t of node.trials ?? []) {
          for (const s of t.sites) {
            if (!locationIds[s.center]) throw new Error(`Unknown center "${s.center}" on trial "${t.title}"`);
          }
          await tx.trial.create({
            data: {
              title: t.title,
              shorthand: t.shorthand ?? null,
              protocolNumber: t.protocol ?? null,
              nctId: t.nct ?? null,
              phase: t.phase ?? null,
              // The lists name each SITE's PI, not the national lead PI.
              principalInvestigator: null,
              eligibilityCriteria: trialText(t),
              decisionNodeId: created.id,
              source: 'CURATED',
              // Card facts, each sourced in curatedData.ts (NCI Thesaurus or the
              // ClinicalTrials.gov record). Copied as written, never generated.
              intervention: t.intervention ?? null,
              mechanism: t.mechanism ?? null,
              mechanismSources: t.mechanismSources ?? [],
              // The one-sentence brief is sourced text committed to the curated
              // file, so it is approved on load. It is paraphrased from the
              // ClinicalTrials.gov record when the trial has an NCT, and from
              // the center's own list when it does not.
              summary: t.brief ?? null,
              summarySource: t.brief ? (t.nct ? 'CTGOV' : 'CURATED') : null,
              summaryApproved: Boolean(t.brief),
              summaryGeneratedAt: null,
              // An NCT in the curated file came from a center's list or a
              // curator's lookup; the enrichment job marks its own AUTO_MATCHED.
              nctSource: t.nct ? 'CURATED' : null,
              // A curator's veto of a ClinicalTrials.gov record for this trial.
              // Stored as a REJECTED candidate, which the enrichment job never
              // links automatically or proposes again; recreated on every reload.
              ...(t.rejectNct && t.rejectNct.length > 0
                ? {
                    nctMatchCandidates: {
                      // Upper-cased and de-duplicated: the registry's ids are
                      // upper case, and a repeat would trip the unique index
                      // and roll back the whole reload.
                      create: Array.from(new Set(t.rejectNct.map((n) => n.trim().toUpperCase()))).map((nctId) => ({
                        nctId,
                        candidateTitle: 'Rejected by a curator in curatedData.ts',
                        confidence: 0,
                        status: 'REJECTED' as const,
                      })),
                    },
                  }
                : {}),
              locations: {
                create: t.sites.map((s) => ({
                  locationId: locationIds[s.center],
                  status: 'RECRUITING' as const,
                  piName: s.pi,
                  slotsOpen: s.slotsOpen ?? null,
                  source: 'CURATED',
                })),
              },
            },
          });
          summary.trials += 1;
          summary.siteLinks += t.sites.length;
          summary.perTree[tree] += 1;
        }

        let i = 0;
        for (const child of node.children ?? []) await build(child, created.id, i++, tree);
      };

      let order = 0;
      for (const root of CURATED_TREES) {
        summary.perTree[root.label] = 0;
        await build(root, null, order++, root.label);
      }
      return summary;
    },
    // ~95 trials and their site links — well inside this, but the default 5s
    // is too tight for a cold connection.
    { timeout: 60_000, maxWait: 10_000 },
  );
}
