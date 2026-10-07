import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { devToolsEnabled } from '@/lib/devGuard';
import { enrichAll } from '@/lib/ctgov/enrich';
import { publishTreeUpdate } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The reload is quick; the ClinicalTrials.gov enrichment after it is not.
export const maxDuration = 180;

// DEV/TEST ONLY. Loads the curated trial lists so you can populate a freshly
// deployed instance from the browser (no shell). Wipes existing trials first.
// Guarded by devToolsEnabled() — 404 in production unless ENABLE_DEV_SIMULATE=true.
//
// A reload drops every registry fact and automatic NCT match, so — exactly as
// /api/dev/curate does — enrichment runs straight after it, and a slow or
// unreachable registry never turns a good reload into a reported failure.
async function handle() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  const seeded = await seedDatabase(prisma).then(
    (summary) => ({ ok: true as const, summary }),
    (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'seed failed' }),
  );
  if (!seeded.ok) {
    return NextResponse.json({ status: 'ERROR', error: seeded.error }, { status: 500 });
  }
  const summary = seeded.summary;
  publishTreeUpdate({ location: 'all', action: 'CURATE', summary: `Loaded ${summary.trials} curated trials` });

  let enrichment: unknown;
  try {
    enrichment = await enrichAll(prisma);
    publishTreeUpdate({ location: 'all', action: 'ENRICH', summary: 'ClinicalTrials.gov details refreshed' });
  } catch (e) {
    enrichment = { error: e instanceof Error ? e.message : 'enrichment failed' };
  }
  return NextResponse.json({ status: 'SEEDED', ...summary, enrichment });
}

export const GET = handle;
export const POST = handle;
