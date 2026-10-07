import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { reloadCuratedData, type ReloadSummary } from '@/lib/tree/curated';
import { enrichAll, type EnrichmentResult } from '@/lib/ctgov/enrich';
import { publishTreeUpdate } from '@/lib/events';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The reload, then up to 90s of ClinicalTrials.gov enrichment (a soft budget
// that can overshoot by one in-flight request).
export const maxDuration = 180;

// Reloads the database from the human-curated trial lists
// (src/lib/tree/curatedData.ts): removes every trial and tree node, then
// rebuilds them from the file. Runs in one transaction, so a failure changes
// nothing. Guarded — 404 unless ENABLE_DEV_SIMULATE=true.
//
// A reload drops what enrichment added, so enrichment re-runs straight after
// it. The two are reported separately on purpose: a slow or failing registry
// must never make a successful reload read as failed.
type Reloaded = { ok: true; summary: ReloadSummary } | { ok: false; error: string };

async function reload(): Promise<Reloaded> {
  try {
    const summary = await reloadCuratedData(prisma);
    publishTreeUpdate({
      location: 'all',
      action: 'CURATE',
      summary: `Loaded ${summary.trials} curated trials`,
    });
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'curate failed' };
  }
}

async function handle() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });

  const reloaded = await reload();
  if (!reloaded.ok) {
    return NextResponse.json({ status: 'ERROR', error: reloaded.error }, { status: 500 });
  }

  let enrichment: EnrichmentResult | { error: string };
  try {
    const result = await enrichAll(prisma);
    enrichment = result;
    // NCT links and registry facts show on the cards, so kiosks should redraw.
    if (result.matched.length > 0 || result.refreshed > 0) {
      publishTreeUpdate({
        location: 'all',
        action: 'ENRICH',
        summary: `Linked ${result.matched.length} NCT numbers; refreshed registry facts for ${result.refreshed} trials`,
      });
    }
  } catch (e) {
    enrichment = { error: e instanceof Error ? e.message : 'enrichment failed' };
  }

  return NextResponse.json({ status: 'CURATED', ...reloaded.summary, enrichment });
}

export const GET = handle;
export const POST = handle;
