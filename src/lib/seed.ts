import type { PrismaClient } from '@prisma/client';
import { reloadCuratedData } from './tree/curated';

// "Seeding" now means loading the real, human-curated trial lists
// (src/lib/tree/curatedData.ts). The old demo data — fake trials and fake
// clinicians — is gone, so no path can put made-up trials back on the site.
//
// Unlike the old demo seed, this leaves the audit log, review queue, and
// clinician allowlist untouched; it only rebuilds trials and the tree.
// Called by the CLI (prisma/seed.ts) and the guarded /api/dev/seed endpoint.
export async function seedDatabase(prisma: PrismaClient): Promise<{ locations: number; trials: number }> {
  const s = await reloadCuratedData(prisma);
  return { locations: s.centers, trials: s.trials };
}
