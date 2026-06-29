import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/lib/seed';

// CLI entry point: `npm run db:seed`. The actual seed logic lives in
// src/lib/seed.ts so the /api/dev/seed endpoint can reuse it.
const prisma = new PrismaClient();

seedDatabase(prisma)
  .then((summary) => console.log('Seeded:', summary))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
