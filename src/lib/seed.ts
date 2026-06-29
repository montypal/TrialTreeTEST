import { type PrismaClient, NodeKind, RecruitmentStatus } from '@prisma/client';
import { CENTERS } from './locations';

// Reusable seed routine — called by the CLI (prisma/seed.ts) and by the guarded
// /api/dev/seed endpoint so you can load demo data on a deployed test instance
// straight from the browser. Idempotent: wipes in dependency order, then rebuilds.
export async function seedDatabase(prisma: PrismaClient): Promise<{ locations: number; trials: number }> {
  await prisma.actionLog.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.trialLocation.deleteMany();
  await prisma.trial.deleteMany();
  await prisma.decisionNode.deleteMany();
  await prisma.clinician.deleteMany();
  await prisma.location.deleteMany();

  // --- Locations (the 5 SoCal centers) ------------------------------------
  const locations: Record<string, string> = {};
  for (const c of CENTERS) {
    const loc = await prisma.location.create({
      data: { slug: c.slug, name: c.name, shortName: c.shortName },
    });
    locations[c.slug] = loc.id;
  }

  // --- Authorized clinicians (allowlist for inbound SMS/email) -------------
  await prisma.clinician.createMany({
    data: [
      { name: 'Dr. Maya Chen', phone: '+13105550123', email: 'mchen@mednet.ucla.edu', role: 'PI', locationId: locations['ucla'] },
      { name: 'Dr. Andre Okafor', phone: '+16265550150', email: 'aokafor@cityofhope.org', role: 'PI', locationId: locations['city-of-hope'] },
      { name: 'Dr. Priya Nair', phone: '+18585550177', email: 'pnair@health.ucsd.edu', role: 'Coordinator', locationId: locations['ucsd'] },
    ],
  });

  // --- Decision tree topology ---------------------------------------------
  const node = (label: string, kind: NodeKind, parentId: string | null, sortOrder = 0) =>
    prisma.decisionNode.create({ data: { label, kind, parentId, sortOrder } });

  // Prostate branch
  const prostate = await node('Prostate Cancer', NodeKind.DISEASE_TYPE, null, 0);
  const mcrpc = await node('Metastatic CRPC (mCRPC)', NodeKind.DISEASE_STATE, prostate.id, 0);
  const mhspc = await node('Metastatic Hormone-Sensitive', NodeKind.DISEASE_STATE, prostate.id, 1);
  const prostate2L = await node('Second-line therapy', NodeKind.LINE_OF_THERAPY, mcrpc.id, 0);
  const prostate1L = await node('First-line therapy', NodeKind.LINE_OF_THERAPY, mhspc.id, 0);
  const hrr = await node('HRR-mutated', NodeKind.BIOMARKER, prostate2L.id, 0);

  // Bladder branch
  const bladder = await node('Bladder Cancer', NodeKind.DISEASE_TYPE, null, 1);
  const mibc = await node('Muscle-Invasive (MIBC)', NodeKind.DISEASE_STATE, bladder.id, 0);
  const nmibc = await node('Non-Muscle-Invasive (NMIBC)', NodeKind.DISEASE_STATE, bladder.id, 1);
  const neoadjuvant = await node('Neoadjuvant', NodeKind.LINE_OF_THERAPY, mibc.id, 0);
  const bcgUnresponsive = await node('BCG-unresponsive', NodeKind.DISEASE_STATE, nmibc.id, 0);

  // Renal branch
  const renal = await node('Renal Cell Carcinoma', NodeKind.DISEASE_TYPE, null, 2);
  const mccRCC = await node('Metastatic clear-cell', NodeKind.DISEASE_STATE, renal.id, 0);
  const renal1L = await node('First-line therapy', NodeKind.LINE_OF_THERAPY, mccRCC.id, 0);

  // --- Trials (the leaves) -------------------------------------------------
  await prisma.trial.create({
    data: {
      nctId: 'NCT04821622',
      protocolNumber: 'UCLA-21-0455',
      shorthand: 'HRR prostate study',
      title: 'PARP Inhibitor + ARPI in HRR-mutated mCRPC',
      phase: 'Phase III',
      principalInvestigator: 'Dr. Maya Chen',
      eligibilityCriteria: 'mCRPC, deleterious HRR mutation (BRCA1/2, ATM), ECOG 0-1, prior ARPI.',
      decisionNodeId: hrr.id,
      locations: {
        create: [
          { locationId: locations['ucla'], status: RecruitmentStatus.RECRUITING, piName: 'Dr. Maya Chen', slotsOpen: 6 },
          { locationId: locations['city-of-hope'], status: RecruitmentStatus.WAITLISTED, piName: 'Dr. Andre Okafor' },
        ],
      },
      cohorts: { create: [{ label: 'BRCA2', status: RecruitmentStatus.RECRUITING }] },
    },
  });

  await prisma.trial.create({
    data: {
      nctId: 'NCT05240131',
      protocolNumber: 'COH-22-118',
      shorthand: 'Phase II bladder trial',
      title: 'Neoadjuvant Immunotherapy in MIBC before Cystectomy',
      phase: 'Phase II',
      principalInvestigator: 'Dr. Andre Okafor',
      eligibilityCriteria: 'cT2-T4a N0 M0 urothelial carcinoma, cisplatin-ineligible, ECOG 0-1.',
      decisionNodeId: neoadjuvant.id,
      locations: {
        create: [
          { locationId: locations['city-of-hope'], status: RecruitmentStatus.RECRUITING, piName: 'Dr. Andre Okafor', slotsOpen: 4 },
          { locationId: locations['usc'], status: RecruitmentStatus.RECRUITING, piName: 'Dr. Leo Park' },
        ],
      },
    },
  });

  await prisma.trial.create({
    data: {
      nctId: 'NCT05014139',
      shorthand: 'BCG-unresponsive bladder study',
      title: 'Intravesical Gene Therapy for BCG-unresponsive NMIBC',
      phase: 'Phase II',
      principalInvestigator: 'Dr. Priya Nair',
      decisionNodeId: bcgUnresponsive.id,
      locations: {
        create: [{ locationId: locations['ucsd'], status: RecruitmentStatus.RECRUITING, piName: 'Dr. Priya Nair', slotsOpen: 8 }],
      },
    },
  });

  await prisma.trial.create({
    data: {
      nctId: 'NCT04736706',
      shorthand: 'first-line renal IO combo',
      title: 'Dual IO + TKI in First-line Metastatic ccRCC',
      phase: 'Phase III',
      principalInvestigator: 'Dr. Sofia Ramirez',
      decisionNodeId: renal1L.id,
      locations: {
        create: [
          { locationId: locations['uci'], status: RecruitmentStatus.RECRUITING, piName: 'Dr. Sofia Ramirez', slotsOpen: 3 },
          { locationId: locations['ucla'], status: RecruitmentStatus.CLOSED, piName: 'Dr. Maya Chen' },
        ],
      },
    },
  });

  await prisma.trial.create({
    data: {
      nctId: 'NCT05288166',
      shorthand: 'mHSPC triplet',
      title: 'Triplet Therapy (ADT + ARPI + Chemo) in mHSPC',
      phase: 'Phase III',
      principalInvestigator: 'Dr. Leo Park',
      decisionNodeId: prostate1L.id,
      locations: {
        create: [{ locationId: locations['usc'], status: RecruitmentStatus.RECRUITING, piName: 'Dr. Leo Park', slotsOpen: 5 }],
      },
    },
  });

  return { locations: CENTERS.length, trials: 5 };
}
