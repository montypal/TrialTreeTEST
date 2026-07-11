import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { importFromCtgov } from '@/lib/ctgov/import';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The import fans out to the CT.gov API and does many upserts — give it room.
export const maxDuration = 120;

// Pulls real GU oncology trials from ClinicalTrials.gov into the tree. Safe to
// re-run: it upserts by NCT id and preserves any status a clinician changed by
// text (manualOverride). Guarded — 404 in production unless ENABLE_DEV_SIMULATE=true.
async function handle() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  try {
    const summary = await importFromCtgov(prisma);
    return NextResponse.json({ status: 'IMPORTED', ...summary });
  } catch (e) {
    return NextResponse.json(
      { status: 'ERROR', error: e instanceof Error ? e.message : 'import failed' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
