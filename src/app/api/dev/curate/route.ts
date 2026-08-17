import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { applyCuratedTrees } from '@/lib/tree/curated';
import { publishTreeUpdate } from '@/lib/events';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rebuilds the hand-authored (curated) trees — currently the kidney/RCC
// skeleton. Drops the old auto-classified RCC subtree (and its trials) and
// recreates the clinician-defined Stage → Histology → Line structure, empty and
// ready for a curated trial list. Guarded — 404 unless ENABLE_DEV_SIMULATE=true.
async function handle() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  try {
    const built = await applyCuratedTrees(prisma);
    publishTreeUpdate({
      location: 'all',
      action: 'CURATE',
      summary: `Rebuilt curated tree: ${built.join(', ')}`,
    });
    return NextResponse.json({ status: 'CURATED', built });
  } catch (e) {
    return NextResponse.json(
      { status: 'ERROR', error: e instanceof Error ? e.message : 'curate failed' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
