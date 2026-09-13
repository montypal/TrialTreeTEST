import { NextResponse } from 'next/server';
import { devToolsEnabled } from '@/lib/devGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ClinicalTrials.gov auto-import is switched OFF. Trials now come only from the
// clinician-provided lists in src/lib/tree/curatedData.ts — an import would put
// non-list trials back on the site. (The importer code in src/lib/ctgov/ is
// kept, e.g. for looking up details of a listed trial by NCT id later.)
async function handle() {
  if (!devToolsEnabled()) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json(
    {
      status: 'DISABLED',
      message:
        'ClinicalTrials.gov auto-import is disabled — trials come only from the curated lists. ' +
        'Edit src/lib/tree/curatedData.ts and POST /api/dev/curate to reload.',
    },
    { status: 410 },
  );
}

export const GET = handle;
export const POST = handle;
