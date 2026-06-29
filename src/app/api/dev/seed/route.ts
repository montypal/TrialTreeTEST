import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DEV/TEST ONLY. Loads the SoCal GU demo data so you can populate a freshly
// deployed instance from the browser (no shell). Wipes existing data first.
// Guarded by devToolsEnabled() — 404 in production unless ENABLE_DEV_SIMULATE=true.
async function handle() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  try {
    const summary = await seedDatabase(prisma);
    return NextResponse.json({ status: 'SEEDED', ...summary });
  } catch (e) {
    return NextResponse.json(
      { status: 'ERROR', error: e instanceof Error ? e.message : 'seed failed' },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
