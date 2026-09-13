import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { reloadCuratedData } from '@/lib/tree/curated';
import { publishTreeUpdate } from '@/lib/events';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Reloads the database from the human-curated trial lists
// (src/lib/tree/curatedData.ts): removes every trial and tree node, then
// rebuilds them from the file. Runs in one transaction, so a failure changes
// nothing. Guarded — 404 unless ENABLE_DEV_SIMULATE=true.
async function handle() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  try {
    const summary = await reloadCuratedData(prisma);
    publishTreeUpdate({
      location: 'all',
      action: 'CURATE',
      summary: `Loaded ${summary.trials} curated trials`,
    });
    return NextResponse.json({ status: 'CURATED', ...summary });
  } catch (e) {
    return NextResponse.json(
      { status: 'ERROR', error: e instanceof Error ? e.message : 'curate failed' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
