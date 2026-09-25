// ---------------------------------------------------------------------------
// THE SOURCE OF TRUTH for every trial in TrialTree.
//
// Trials are human-curated — transcribed from the clinician-provided lists
// below. Nothing is auto-imported from ClinicalTrials.gov. To update the site,
// edit this file, deploy, then hit POST /api/dev/curate to reload the DB.
//
// Sources:
//   • Cedars-Sinai CURE lists, 2 Jun 2026 (Prostate, Bladder, Kidney PDFs)
//   • UC San Diego "GU Clinical Trials List", updated 4 Sep 2026
//     (identified as UCSD by its @health.ucsd.edu contacts and its
//     Hillcrest / La Jolla campuses; the PDF itself doesn't name the site)
//   • USC "GU & Urology Clinical Trials – Open to Accrual", 8 Sep 2026
//     (identified as USC by its @med.usc.edu contacts)
//
// A trial open at more than one centre is ONE trial with several sites
// (confirmed against ClinicalTrials.gov protocol IDs where not identical).
//
// Placement:
//   • Kidney follows the clinician's whiteboard tree exactly
//     (Stage → Histology → Line; only Clear cell carries therapy lines).
//   • Prostate and Bladder use the lists' own section headers as one level,
//     pending the clinician's whiteboard trees for those cancers.
//   • A few rows sit under a section that doesn't match the trial's own
//     title; those were placed by the title and are marked "placement:" below.
//
// PIs are surnames only, exactly as the lists give them. Coordinator names,
// emails and phone numbers are deliberately NOT stored — this site is public
// and has no login.
// ---------------------------------------------------------------------------

export type CenterSlug = 'cedars-sinai' | 'ucsd' | 'usc';

export type CuratedSite = {
  center: CenterSlug;
  pi: string | null;
  notes?: string;
  slotsOpen?: number;
};

export type CuratedTrial = {
  title: string;
  shorthand?: string;
  protocol?: string;
  nct?: string;
  phase?: string;
  /** The list's own sub-heading for this trial (e.g. "Patients on active surveillance"). */
  setting?: string;
  summary?: string;
  sites: CuratedSite[];
};

export type NodeKind = 'DISEASE_TYPE' | 'DISEASE_STATE' | 'BIOMARKER' | 'LINE_OF_THERAPY';

export type CuratedNode = {
  label: string;
  kind: NodeKind;
  /** Axis label shown on the node (Cancer / Stage / Histology / Line …). */
  tag: string;
  children?: CuratedNode[];
  trials?: CuratedTrial[];
};

const cedars = (pi: string | null): CuratedSite => ({ center: 'cedars-sinai', pi });

/** UCSD rows carry an IRB number and optional operational notes. */
const ucsd = (irb: string, pi: string, notes?: string, slotsOpen?: number): CuratedSite => ({
  center: 'ucsd',
  pi,
  notes: [`IRB ${irb}`, notes].filter(Boolean).join('. '),
  slotsOpen,
});

/** USC rows carry a study number and optional operational notes. */
const usc = (studyNo: string, pi: string | null, notes?: string): CuratedSite => ({
  center: 'usc',
  pi,
  notes: [`Study ${studyNo}`, notes].filter(Boolean).join('. '),
});

const OPEN_HILLCREST = 'Open at Hillcrest';
const COORDINATOR_TBD = 'Coordinator TBD — contact the project manager';
/** USC marks some studies as also open at LA General (their county partner). */
const ALSO_LAG = 'Also open at LA General (LAG)';
/**
 * Two USC rows (4P-25-4 and AGCT1532) print the PI as a bare "D" — an initial,
 * not a surname. Recorded as unnamed rather than guessed at.
 */
const USC_PI_INITIAL = 'PI given only as "D" on the USC list';

// ─── PROSTATE ──────────────────────────────────────────────────────────────
const PROSTATE: CuratedNode = {
  label: 'Prostate Cancer',
  kind: 'DISEASE_TYPE',
  tag: 'Cancer',
  children: [
    {
      label: 'Localized',
      kind: 'DISEASE_STATE',
      tag: 'State',
      trials: [
        {
          title:
            'Lowering Cholesterol in Prostate Cancer to Target Rapamycin-Insensitive Companion of mTOR (TORC2) in CD8+ Lymphocytes',
          nct: 'NCT06437574',
          phase: 'Phase 2',
          setting: 'Patients on active surveillance',
          summary:
            'Phase II study testing intensive cholesterol lowering with simvastatin + ezetimibe in men with prostate cancer on active surveillance, assessing anti-tumor CD8+ T-cell immune modulation.',
          sites: [cedars(null)],
        },
        {
          title: 'URO-PRO: urolithin A (supplement) vs placebo + radical prostatectomy',
          shorthand: 'URO-PRO',
          nct: 'NCT06022822',
          phase: 'Phase 2',
          setting: 'Patients undergoing prostatectomy',
          summary:
            'A randomized phase II neoadjuvant trial evaluating whether 3–6 weeks of oral urolithin A (natural probiotic) supplementation before radical prostatectomy can reduce oxidative stress and favorably modulate tumor biology in men with localized prostate adenocarcinoma undergoing surgery.',
          sites: [cedars('Freedland')],
        },
        {
          title: 'PC-NET (pre-surgical epigenetic therapy): azacitidine x 5 days',
          shorthand: 'PC-NET',
          nct: 'NCT06888102',
          setting: 'Patients undergoing prostatectomy',
          summary:
            'Platform study looking at modulators of DNA methylation that promote sensitivity of prostate cancer to the immune system, used 1 month prior to prostatectomy.',
          sites: [cedars('Posadas')],
        },
        {
          title: 'NRG-GU013 (HIGH FIVE): SBRT vs EBRT',
          shorthand: 'HIGH FIVE',
          protocol: 'NRG-GU013',
          nct: 'NCT05946213',
          phase: 'Phase 3',
          setting: 'Primary radiotherapy — high-risk',
          summary:
            'Phase III trial testing whether 5-fraction SBRT can replace conventional or moderately hypofractionated radiotherapy for high-risk localized prostate cancer without compromising metastasis-free survival.',
          sites: [cedars('Ballas')],
        },
        {
          title: 'RAD-TARGET: Radiation Dose Tailoring Guided by Enhanced Targeting',
          shorthand: 'RAD-TARGET',
          sites: [ucsd('812494', 'Seibert', OPEN_HILLCREST)],
        },
        {
          title: 'BEFORE: Bladder Full or Empty for Pelvic Radiation Therapy',
          shorthand: 'BEFORE',
          sites: [ucsd('811100', 'Seibert', OPEN_HILLCREST)],
        },
        {
          title: 'SENTRY: Strategic Hormone Therapy and Targeted Radiotherapy',
          shorthand: 'SENTRY',
          sites: [ucsd('813314', 'Seibert')],
        },
        {
          title:
            'FOLATE: Phase II, Open-Label, Randomized Controlled Pilot Study Evaluating Trimethoprim in Patients Commencing Androgen Deprivation Therapy for Prostate Cancer',
          shorthand: 'FOLATE',
          phase: 'Phase 2',
          sites: [ucsd('812072', 'Liss')],
        },
        {
          // placement: UCSD lists this under "High-risk mHSPC", but the trial is
          // for LOCALIZED high-risk disease receiving radiotherapy.
          title:
            'EvoPAR02: Phase III Study of Adjuvant Saruparib (AZD5305) in Patients with BRCAm Localized High-Risk Prostate Cancer Receiving Radiotherapy with ADT',
          shorthand: 'EvoPAR02',
          phase: 'Phase 3',
          sites: [ucsd('812443', 'McKay')],
        },
        {
          title:
            'PRIMER: A Novel MRI-based Machine Learning Approach vs Radiologist MRI Reading for Targeted Prostate Biopsy — A Non-Inferiority, Within-Person Randomized Controlled Trial for Prostate Cancer Detection',
          shorthand: 'PRIMER',
          phase: 'Randomized controlled trial',
          setting: 'Suspected or localized prostate cancer — diagnostic',
          summary:
            'Within-person randomized trial comparing machine-learning reading of prostate MRI against radiologist reading to target biopsies. The biopsy cohort must be biopsy-naive with no prior prostate cancer; the prostatectomy cohort excludes neoadjuvant hormonal therapy. 3T multiparametric MRI is required.',
          sites: [usc('4P-25-1', 'Abreu')],
        },
      ],
    },
    {
      label: 'Biochemical recurrence',
      kind: 'DISEASE_STATE',
      tag: 'State',
      trials: [
        {
          title:
            'INDICATE (EA8191): Local or Systemic Therapy Intensification Directed by PET in Prostate Cancer Patients with Post-Prostatectomy Biochemical Recurrence',
          shorthand: 'INDICATE',
          protocol: 'EA8191',
          phase: 'Phase 3',
          sites: [
            ucsd(
              '210237',
              'Randall',
              `Open cohorts: Arms C and D (PET positive for extra-pelvic metastases). ${OPEN_HILLCREST}`,
            ),
          ],
        },
      ],
    },
    {
      label: 'Metastatic hormone-sensitive (mHSPC)',
      kind: 'DISEASE_STATE',
      tag: 'State',
      trials: [
        {
          title: 'FASTPRO: intermittent fasting with ADT + ARPI',
          shorthand: 'FASTPRO',
          nct: 'NCT05832086',
          phase: 'Phase 2',
          setting: 'No prior treatment / first hormonal maneuver',
          summary:
            'Phase II study testing whether periodic fasting-mimicking diets enhance treatment response and metabolic health in men receiving first-line therapy for metastatic castration-sensitive prostate cancer.',
          sites: [cedars('Freedland')],
        },
        {
          // placement: UCSD lists "SWOG 1802" under "Newly diagnosed / locally
          // advanced"; the trial is for newly diagnosed METASTATIC disease.
          title: 'S1802: systemic therapy ± local therapy of the primary tumor',
          shorthand: 'S1802',
          protocol: 'S1802',
          nct: 'NCT03678025',
          phase: 'Phase 3',
          setting: 'No prior treatment / first hormonal maneuver',
          summary:
            'Phase III study testing whether treatment of the primary prostate tumor with surgery or radiation, in addition to standard systemic therapy, improves outcomes in newly diagnosed metastatic prostate cancer.',
          sites: [cedars('Posadas'), ucsd('181866', 'Bagrodia'), usc('S1802', 'Daneshmand', ALSO_LAG)],
        },
        {
          title:
            'C2321008 (MEVPRO-3): mevrometostat (EZH2 inhibitor) + enzalutamide vs placebo + enzalutamide',
          shorthand: 'MEVPRO-3',
          protocol: 'C2321008',
          nct: 'NCT07028853',
          phase: 'Phase 3',
          setting: 'No prior treatment / first hormonal maneuver',
          summary:
            'Phase III study testing whether adding the EZH2 inhibitor mevrometostat to standard enzalutamide-based therapy improves outcomes in patients with newly diagnosed metastatic castration-sensitive prostate cancer.',
          sites: [cedars('Scher')],
        },
        {
          title: 'Triple Switch: ADT + ARPI ± docetaxel',
          shorthand: 'TRIPLE-SWITCH',
          nct: 'NCT06592924',
          phase: 'Phase 3',
          setting: 'On ADT + ARPI with PSA that does not decline below 0.2 ng/mL',
          summary:
            'Phase III study testing whether the addition of docetaxel improves outcomes in men with metastatic castration-sensitive prostate cancer who fail to achieve an optimal PSA response (i.e. PSA <0.2 ng/mL) to initial ADT plus ARPI therapy.',
          sites: [cedars('Posadas'), usc('CCTG-PR26', 'Pinski', ALSO_LAG)],
        },
        {
          title:
            'TERPS: Randomized Total Eradication of Metastatic Lesions Following Definitive Radiation to the Prostate in De Novo Oligometastatic Prostate Cancer',
          shorthand: 'TERPS',
          phase: 'Phase 2',
          sites: [ucsd('805523', 'Seibert', OPEN_HILLCREST)],
        },
        {
          title: 'TRITONS: Total Radiotherapy of Oligometastatic Cancers',
          shorthand: 'TRITONS',
          sites: [ucsd('810616', 'Seibert', OPEN_HILLCREST)],
        },
        {
          // Not the same trial as Triple Switch (that is CCTG-PR26).
          title: 'A032302 (ASPIRE): Docetaxel Addition in Metastatic Castrate-Sensitive Prostate Cancer',
          shorthand: 'ASPIRE',
          protocol: 'A032302',
          sites: [ucsd('813502', 'Chen')],
        },
      ],
    },
    {
      label: 'Metastatic castration-resistant (mCRPC)',
      kind: 'DISEASE_STATE',
      tag: 'State',
      trials: [
        {
          title: 'AR105: enzalutamide + carotuximab',
          shorthand: 'AR105',
          nct: 'NCT05534646',
          phase: 'Phase 2',
          setting: 'No prior chemotherapy & seeks a non-chemotherapy option',
          summary:
            'Phase II study testing enzalutamide with or without carotuximab, a CD105-targeting antibody which re-sensitizes cancers to hormone therapy, in patients with ARSI-resistant metastatic castration-resistant prostate cancer.',
          sites: [cedars('Posadas')],
        },
        {
          title: 'IDeate-Prostate01 (MK-2400 / I-DXd, a B7-H3 ADC) vs docetaxel',
          shorthand: 'IDeate-Prostate01',
          protocol: 'MK-2400-001',
          nct: 'NCT06925737',
          phase: 'Phase 3',
          setting: 'No prior chemotherapy but needs cytotoxic treatment',
          summary:
            'Phase III study to determine if a B7-H3–targeted antibody-drug conjugate, ifinatamab deruxtecan, can improve outcomes compared with docetaxel in patients with ARPI-pretreated metastatic castration-resistant prostate cancer.',
          sites: [cedars('Posadas'), ucsd('812152', 'McKay')],
        },
        {
          // Same trial as UCSD's "Janssen 78278343PCR3001" (CT.gov protocol ID).
          title: 'KLK2-comPAS (KLK2 × CD3 T-cell engager): pasritamig vs placebo',
          shorthand: 'KLK2-comPAS',
          protocol: '78278343PCR3001',
          nct: 'NCT07164443',
          phase: 'Phase 3',
          setting: 'After chemotherapy + after Lu-PSMA (Pluvicto)',
          summary:
            'Phase III study testing the KLK2-directed T-cell engager pasritamig versus placebo in late-line metastatic castration-resistant prostate cancer after progression on standard life-prolonging therapies.',
          sites: [cedars('Posadas'), ucsd('812903', 'Chen')],
        },
        {
          title: 'A032102 (PREDICT): Precision Diagnostics in Prostate Cancer Treatment',
          shorthand: 'PREDICT',
          protocol: 'A032102',
          sites: [ucsd('811522', 'McKay', `All arms open. ${OPEN_HILLCREST}`)],
        },
        {
          title:
            'CONVERGE-01: Dosimetry, Randomized Dose Optimization, Dose Escalation and Efficacy of Ac-225 Rosopatamab Tetraxetan in PSMA PET-Positive Castration-Resistant Prostate Cancer',
          shorthand: 'CONVERGE-01',
          phase: 'Phase 2',
          sites: [ucsd('810603', 'McKay', OPEN_HILLCREST)],
        },
        {
          title:
            'ACE-232-001: Safety, Pharmacokinetics, Pharmacodynamics, and Preliminary Efficacy of ACE-232 in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'ACE-232-001',
          phase: 'Phase 1',
          sites: [ucsd('812159', 'McKay')],
        },
        {
          title:
            'MK-5684-01A: Umbrella Substudy of MK-5684-based Treatment Combinations or MK-5684 Alone in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'MK-5684-01A',
          phase: 'Phase 1/2',
          sites: [
            ucsd('810621', 'McKay', 'Open cohorts: 9 spaces open for Arm 3 docetaxel-naïve patients', 9),
          ],
        },
        {
          title:
            'TALENT (PCCTC #c24-349): Talazoparib With or Without Enzalutamide in mCRPC with HRR Mutations After Progression on Abiraterone Acetate',
          shorthand: 'TALENT',
          protocol: 'PCCTC c24-349',
          phase: 'Phase 2',
          sites: [ucsd('813246', 'McKay')],
        },
        {
          title:
            'DS3201-343: Valemetostat (DS-3201) in Combination with Darolutamide in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'DS3201-343',
          phase: 'Phase 1',
          sites: [ucsd('813462', 'McKay')],
        },
        {
          title:
            'GSK 300164 (PROTAC): First-in-Human Dose Escalation and Dose Optimization Study of GSK5471713 in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'GSK 300164',
          phase: 'Phase 1/2',
          sites: [ucsd('814157', 'McKay')],
        },
        {
          title:
            'KLK2-PASenger (78278343PCR3003): Pasritamig (JNJ-78278343) With Docetaxel Versus Docetaxel for Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'KLK2-PASenger',
          protocol: '78278343PCR3003',
          phase: 'Phase 3',
          sites: [ucsd('813463', 'McKay'), usc('4P-25-4', null, `${USC_PI_INITIAL}. ${ALSO_LAG}`)],
        },
        {
          title:
            'TIDAL (PCCTC/MSKCC #c24-347): Tarlatamab in Delta-like Protein 3 (DLL3) Positive Metastatic Prostate Cancer',
          shorthand: 'TIDAL',
          protocol: 'PCCTC c24-347',
          phase: 'Phase 2',
          sites: [ucsd('813461', 'McKay')],
        },
        {
          title: 'JANX014: Open-Label, Multicenter Study of JANX014 in Participants with Prostate Cancer',
          shorthand: 'JANX014',
          phase: 'Phase 1',
          sites: [ucsd('814780', 'McKay')],
        },
        {
          title:
            'PSMA-007-001 (JANX007): Open-Label, Multicenter Study of JANX007 in Subjects with Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'JANX007',
          protocol: 'PSMA-007-001',
          phase: 'Phase 1',
          setting: 'Post-taxane, or taxane unsuitable or refused',
          summary:
            'Progressive mCRPC after novel anti-androgen therapy and taxane exposure, or when taxane is unsuitable or refused. Requires at least one novel anti-androgen and at least one failed taxane unless medically unsuitable or actively refusing taxane; progression by PCWG3 and/or RECIST 1.1.',
          sites: [
            usc(
              '4P-25-2',
              'Pinski',
              'Only participating in Parts 3 and 4. Slot assignment must be requested from the sponsor before the patient signs consent',
            ),
          ],
        },
        {
          title:
            'NCI 10487: A Phase II Study of Lutetium Lu 177 Dotatate in Metastatic Prostate Cancer with Neuroendocrine Differentiation',
          shorthand: 'NCI 10487',
          protocol: 'NCI 10487',
          phase: 'Phase 2',
          setting: 'Neuroendocrine differentiation',
          summary:
            'Progressive metastatic prostate cancer with neuroendocrine histologic, molecular, clinical, or biochemical features. Requires at least one 68Ga-DOTATATE-positive lesion; bone-only disease is allowed; prior cytotoxic chemotherapy is allowed but not required; ongoing castration unless the histology is pure neuroendocrine.',
          sites: [usc('4P-23-6', 'Pinski')],
        },
      ],
    },
  ],
};

// ─── BLADDER ───────────────────────────────────────────────────────────────
const BLADDER: CuratedNode = {
  label: 'Bladder Cancer',
  kind: 'DISEASE_TYPE',
  tag: 'Cancer',
  children: [
    {
      label: 'Non-muscle-invasive (NMIBC)',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      trials: [
        {
          title: 'INT22-09-01: A Randomized Trial of Bicalutamide in Non-Muscle Invasive Bladder Cancer',
          shorthand: 'INT22-09-01',
          protocol: 'INT22-09-01',
          nct: 'NCT05521698',
          phase: 'Phase 2',
          summary:
            'Randomized phase II window-of-opportunity trial of oral bicalutamide before TURBT in biologic male adults with non–muscle-invasive bladder cancer, assessing EGFR/AR-related biomarker modulation and toxicity.',
          sites: [cedars(null)],
        },
        {
          title:
            'QUILT-2.005: Intravesical BCG in Combination With ALT-803 (N-803) in Patients With Non-Muscle Invasive Bladder Cancer',
          shorthand: 'QUILT-2.005',
          sites: [ucsd('810939', 'Salmasi', OPEN_HILLCREST)],
        },
        {
          title:
            'NRG-GU014 (PARRC): Randomized Phase II Trial of Pembrolizumab and Radiation vs. Radiation and Concurrent Chemotherapy for High-Grade T1 Bladder Cancer',
          shorthand: 'PARRC',
          protocol: 'NRG-GU014',
          phase: 'Phase 2',
          setting: 'Very high-risk NMIBC',
          summary:
            'High-grade T1 N0 M0 disease with recurrent, persistent, or adverse pathologic features, ordinarily warranting a cystectomy recommendation. Focal CIS is allowed; diffuse CIS is excluded.',
          sites: [usc('NRG-GU014', 'Lukas', ALSO_LAG)],
        },
        {
          title:
            'ABLE-22: Intravesical Nadofaragene Firadenovec Alone or With Chemotherapy (Gemcitabine and Docetaxel) or Immunotherapy (Pembrolizumab) in High-grade BCG-Unresponsive Non-muscle Invasive Bladder Cancer',
          shorthand: 'ABLE-22',
          phase: 'Phase 3',
          setting: 'BCG-unresponsive NMIBC',
          summary:
            'BCG-unresponsive NMIBC with CIS, with or without high-grade Ta/T1. Adequate prior BCG is required and the patient elects not to undergo cystectomy.',
          sites: [usc('4B-25-3', 'Daneshmand')],
        },
        {
          title:
            'CRETO EAP: Expanded Access Program of Cretostimogene Grenadenorepvec in High-Risk Non-Muscle Invasive Bladder Cancer Unresponsive to Bacillus Calmette-Guerin',
          shorthand: 'CRETO EAP',
          phase: 'Expanded access',
          setting: 'BCG-unresponsive NMIBC',
          summary:
            'BCG-unresponsive NMIBC with CIS, with or without high-grade Ta/T1. Adequate prior BCG is required and the patient refuses cystectomy or is medically unfit for it.',
          sites: [usc('4B-25-5', 'Schuckman', ALSO_LAG)],
        },
        {
          title:
            'EG-70-101: EG-70 as an Intravesical Administration to Patients with BCG-Unresponsive NMIBC and High-Risk NMIBC Patients who are BCG Naive or Received Incomplete BCG Treatment — A Master Protocol for EG-70 in Urothelial Cancers',
          shorthand: 'EG-70-101',
          phase: 'Phase 1/2',
          setting: 'High-risk NMIBC — cohort-specific BCG settings',
          summary:
            'High-risk NMIBC with CIS with or without Ta/T1; a separate papillary high-grade Ta/T1 cohort is included. Eligibility depends on the cohort (BCG-naive, BCG-exposed, or BCG-unresponsive), and cystectomy refusal or ineligibility applies in selected cohorts.',
          sites: [usc('4B-22-2', 'Schuckman')],
        },
        {
          title:
            'CORE-008: Multi-arm, Multi-cohort, Open-label Study of Cretostimogene Grenadenorepvec in Participants with High-risk Non-muscle-invasive Bladder Cancer',
          shorthand: 'CORE-008',
          phase: 'Phase 2',
          setting: 'High-risk NMIBC — cohort-specific BCG settings',
          summary:
            'High-risk NMIBC with CIS with or without Ta/T1, or papillary high-grade Ta/T1. Eligibility and cystectomy requirements are cohort-specific across BCG-naive, BCG-exposed, and BCG-unresponsive populations.',
          sites: [usc('4B-24-4', 'Daneshmand')],
        },
        {
          title:
            'INTerpath-011: Open-label Randomized Study of V940 in Combination With BCG Versus BCG Monotherapy in Participants With High-risk Non-muscle Invasive Bladder Cancer',
          shorthand: 'INTerpath-011',
          phase: 'Phase 2',
          setting: 'BCG-naive high-risk NMIBC',
          summary:
            'BCG-naive high-risk NMIBC: T1, large or multifocal high-grade Ta, or CIS with or without papillary disease. The main cohort is BCG-naive; CIS is not required and cystectomy is not the central matching criterion.',
          sites: [usc('4B-25-1', 'Aron')],
        },
        {
          title:
            'rBCG EAP (ResQ132EX-NMIBC): Expanded Access Use of Recombinant Bacillus Calmette-Guerin in Nonmuscle Invasive Bladder Cancer',
          shorthand: 'rBCG EAP',
          phase: 'Expanded access',
          setting: 'NMIBC access study',
          summary:
            'Broad NMIBC population seeking BCG access, including BCG-naive patients when TICE BCG is unavailable. Exact Ta/T1/CIS risk criteria are not specified on the source list.',
          sites: [usc('4B-25-6', 'Daneshmand', ALSO_LAG)],
        },
        {
          title: 'Blue Light Cystoscopy with Cysview (BLC with Cysview) Registry',
          shorthand: 'BLC with Cysview',
          phase: 'Registry',
          setting: 'NMIBC diagnosis and surveillance',
          summary:
            'Suspected or known NMIBC in diagnostic or surveillance care; CIS, Ta, and T1 may be represented. BCG exposure and cystectomy status are not defining criteria.',
          sites: [usc('4B-13-1', 'Daneshmand')],
        },
        {
          title:
            'Nova-sTAR: Multicenter, Prospective, Longitudinal Study to Assess Real-world Use and Outcomes After the Launch of TAR-200 for NMIBC in the US',
          shorthand: 'Nova-sTAR',
          phase: 'Real-world prospective',
          setting: 'NMIBC after TAR-200 initiation',
          summary:
            'Real-world NMIBC after TAR-200 initiation; Ta, T1, or CIS may be represented. Prior BCG exposure is broad and is collected as a variable rather than used as a protocol-defined stage category.',
          sites: [usc('4B-26-1', 'Daneshmand')],
        },
      ],
    },
    {
      label: 'Muscle-invasive (MIBC)',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      trials: [
        {
          title: 'VHTMT: neoadjuvant chemotherapy ± immunotherapy followed by tri-modal therapy (TMT)',
          shorthand: 'VHTMT',
          nct: 'NCT06417190',
          phase: 'Phase 2',
          setting: 'Non-urothelial histology',
          summary:
            'Phase II bladder-sparing trial for patients with muscle-invasive bladder cancer and variant histology, evaluating a multimodal treatment strategy as an alternative to radical cystectomy.',
          sites: [cedars('Ballas')],
        },
        {
          title: 'S2427 (BRIGHT): bladder-sparing radiotherapy + pembrolizumab',
          shorthand: 'BRIGHT',
          protocol: 'S2427',
          nct: 'NCT07061964',
          phase: 'Phase 2',
          setting: 'After neoadjuvant chemotherapy with good response',
          summary:
            'Phase II study testing pembrolizumab plus radiation as a bladder-sparing strategy for patients with muscle-invasive bladder cancer who achieve a clinical response after neoadjuvant therapy.',
          sites: [cedars('Ballas'), usc('S2427', 'Daneshmand')],
        },
        {
          title: 'NRG-GU015 (ARCHER): 5 vs 20 fractions of radiation',
          shorthand: 'ARCHER',
          protocol: 'NRG-GU015',
          nct: 'NCT07097142',
          phase: 'Phase 3',
          setting: 'Chemoradiotherapy for bladder preservation (tri-modal therapy)',
          summary:
            'Phase III study testing ultra-hypofractionated (5-fraction) versus standard hypofractionated (20-fraction) chemoradiation for bladder preservation in muscle-invasive bladder cancer.',
          sites: [cedars('Ballas'), ucsd('813430', 'Bagrodia')],
        },
        {
          // placement: UCSD lists this under "Metastatic, prior therapy", but it
          // is an ADJUVANT (post-surgery) trial in urothelial cancer.
          title:
            'A032103 (MODERN): MRD-Based Optimization of Adjuvant Therapy in Urothelial Cancer',
          shorthand: 'MODERN',
          protocol: 'A032103',
          phase: 'Phase 2/3',
          sites: [ucsd('810099', 'Stewart')],
        },
      ],
    },
    {
      label: 'Upper tract (UTUC)',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      trials: [
        {
          // placement: UCSD lists this under "Metastatic, prior therapy", but it
          // is for upper-tract disease BEFORE nephroureterectomy.
          title:
            'EA8192: Durvalumab and Chemotherapy for High Grade Upper Tract Urothelial Cancer Prior to Nephroureterectomy',
          shorthand: 'EA8192',
          protocol: 'EA8192',
          phase: 'Phase 2/3',
          sites: [ucsd('812150', 'Bagrodia', `Open cohorts: Arms A and B. ${OPEN_HILLCREST}`)],
        },
        {
          title:
            'TYR300-203 (SURF303): Multi-center, Open-Label Study Evaluating the Efficacy and Safety of Dabogratinib (TYRA-300) in Participants with Low Grade Upper Tract Urothelial Carcinoma',
          shorthand: 'SURF303',
          protocol: 'TYR300-203',
          phase: 'Phase 2A/B',
          setting: 'Low-grade UTUC',
          summary:
            'Adults with biopsy-confirmed low-grade upper tract urothelial carcinoma and at least one measurable papillary tumor. After biopsy at least one marker lesion must remain with diameter ≥5 mm, or multiple lesions with aggregate size ≥5 mm. FGFR3 status is not required for enrollment; ECOG 0–2, pure urothelial histology, and adequate marrow, hepatic, and renal function are required. Excludes high-grade UTUC, CIS, prostatic urethral involvement, muscle-invasive or node-positive/metastatic bladder cancer, and prior FGFR inhibitor; protocol-defined washouts apply for BCG, intravesical/systemic therapy, immunotherapy, and investigational agents.',
          sites: [usc('4B-26-2', 'Daneshmand', ALSO_LAG)],
        },
      ],
    },
    {
      label: 'Metastatic',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      trials: [
        {
          title:
            'DS1062-328: Datopotamab Deruxtecan (Dato-DXd) + Carbo/Cis vs Gemcitabine + Carboplatin/Cisplatin in la/mUC Progressed During or After EV + Pembro',
          shorthand: 'DS1062-328',
          phase: 'Phase 2/3',
          sites: [ucsd('812234', 'Stewart')],
        },
        {
          title:
            'NCI ETCTN 10636: CA-4948 With Pembrolizumab to Overcome Resistance to PD-1/PD-L1 Blockade in Metastatic Urothelial Cancer',
          shorthand: 'ETCTN 10636',
          protocol: 'ETCTN 10636',
          phase: 'Phase 1',
          sites: [ucsd('812410', 'Stewart')],
        },
        {
          title:
            'C6461006: PF-08634404 Monotherapy or in Combination with Enfortumab Vedotin in Locally Advanced or Metastatic Urothelial Cancer',
          shorthand: 'C6461006',
          protocol: 'C6461006',
          phase: 'Phase 1b/2',
          sites: [ucsd('813624', 'Stewart')],
        },
        {
          title:
            'LOXO-LNC-24001: LY4052031, a Nectin-4 Antibody-Drug Conjugate, in Advanced or Metastatic Urothelial Carcinoma or Other Solid Tumors',
          shorthand: 'LOXO-LNC-24001',
          phase: 'Phase 1a/1b',
          sites: [ucsd('814162', 'Stewart', COORDINATOR_TBD)],
        },
      ],
    },
  ],
};

// ─── KIDNEY (RCC) — the clinician's whiteboard tree ────────────────────────
const KIDNEY: CuratedNode = {
  label: 'Renal Cell Carcinoma',
  kind: 'DISEASE_TYPE',
  tag: 'Cancer',
  children: [
    {
      label: 'Non-metastatic',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      // placement: this one sits on the stage node rather than under a
      // histology child. It images an INDETERMINATE renal mass to tell clear
      // cell from not, so the histology branch is exactly what is unknown when
      // a patient is referred to it. The whiteboard's Stage → Histology → Line
      // structure is otherwise untouched.
      trials: [
        {
          title:
            '89Zr-TLX250-007: Expanded Access Program for the Non-invasive Detection of Clear Cell Renal Cell Carcinoma in Patients with Renal Masses Utilizing 89Zirconium-labelled Girentuximab (89Zr-DFO-girentuximab)',
          shorthand: 'Girentuximab PET EAP',
          protocol: '89Zr-TLX250-007',
          phase: 'Expanded access',
          setting: 'Indeterminate renal mass / suspected localized clear-cell RCC',
          summary:
            'A single indeterminate renal mass ≤7 cm, corresponding to clinical T1, with recent CT or MRI. No pathology is required before enrollment; selected patients with prior RCC or suspected metastases may enroll if the qualifying mass is present. GFR >40 mL/min/1.73 m².',
          sites: [usc('4K-24-1', 'Conti')],
        },
      ],
      children: [
        {
          label: 'Clear cell',
          kind: 'BIOMARKER',
          tag: 'Histology',
          children: [
            { label: 'Neoadjuvant', kind: 'LINE_OF_THERAPY', tag: 'Line' },
            {
              label: 'Adjuvant',
              kind: 'LINE_OF_THERAPY',
              tag: 'Line',
              trials: [
                {
                  // placement: UCSD lists STRIKE under "Metastatic, treatment
                  // naive"; it's adjuvant (after surgery), per Cedars + whiteboard.
                  title: 'A032201 (STRIKE): adjuvant pembrolizumab ± tivozanib',
                  shorthand: 'STRIKE',
                  protocol: 'A032201',
                  nct: 'NCT06661720',
                  phase: 'Phase 3',
                  summary:
                    'Phase III study testing whether short-term VEGFR inhibition with tivozanib enhances the efficacy of adjuvant pembrolizumab in patients with high-risk resected clear-cell renal cell carcinoma.',
                  sites: [cedars('Posadas'), ucsd('812777', 'McKay'), usc('A032201', 'Tulpule', ALSO_LAG)],
                },
              ],
            },
          ],
        },
        { label: 'Non-clear cell', kind: 'BIOMARKER', tag: 'Histology' },
      ],
    },
    {
      label: 'Metastatic',
      kind: 'DISEASE_STATE',
      tag: 'Stage',
      children: [
        {
          label: 'Clear cell',
          kind: 'BIOMARKER',
          tag: 'Histology',
          children: [
            {
              label: 'First line',
              kind: 'LINE_OF_THERAPY',
              tag: 'Line',
              trials: [
                {
                  // placement: recurrence after ADJUVANT immunotherapy is the
                  // first line for metastatic disease — the whiteboard put this
                  // trial under First line.
                  title: 'LITESPARK-033: belzutifan plus zanzalintinib vs cabozantinib',
                  shorthand: 'LITESPARK-033',
                  nct: 'NCT07227402',
                  phase: 'Phase 3',
                  setting: 'Progressed after adjuvant pembrolizumab',
                  summary:
                    'Phase III study evaluating belzutifan plus zanzalintinib (XL092, a multi-targeted TKI) versus cabozantinib in patients with recurrent clear-cell RCC after prior adjuvant PD-1/PD-L1 therapy.',
                  sites: [cedars('Posadas'), usc('4K-26-1', 'Sadeghi')],
                },
                {
                  title: 'S1931 (PROBE): immunotherapy ± nephrectomy',
                  shorthand: 'PROBE',
                  protocol: 'S1931',
                  nct: 'NCT04510597',
                  phase: 'Phase 3',
                  setting: 'First-line therapy with kidney in place — surgical candidates',
                  summary:
                    'Phase III trial evaluating cytoreductive nephrectomy plus immunotherapy-based systemic therapy versus immunotherapy-based systemic therapy alone in metastatic renal cell carcinoma.',
                  sites: [cedars('Kim'), usc('S1931', 'Tulpule', ALSO_LAG)],
                },
                {
                  title: 'NRG-GU012 (SAMURAI): immunotherapy ± radiation',
                  shorthand: 'SAMURAI',
                  protocol: 'NRG-GU012',
                  nct: 'NCT05327686',
                  phase: 'Phase 2',
                  setting: 'First-line therapy with kidney in place — non-surgical candidates',
                  summary:
                    'Phase II study testing whether SABR to the primary renal tumor enhances the efficacy of immunotherapy in patients with unresected metastatic renal cell carcinoma.',
                  sites: [cedars('Ballas'), ucsd('805760', 'Seibert', OPEN_HILLCREST)],
                },
                {
                  title:
                    'ARC-20: Dose Escalation and Expansion Study of AB521 Monotherapy and Combination Therapies in Clear Cell Renal Cell Carcinoma and Other Solid Tumors',
                  shorthand: 'ARC-20',
                  phase: 'Phase 1',
                  sites: [ucsd('811338', 'McKay', OPEN_HILLCREST)],
                },
                {
                  // placement: histology not specified ("renal cell carcinoma").
                  title:
                    'C6461008: PF-08634404 Monotherapy and in Combination with Other Anticancer Agents in Locally Advanced or Metastatic Renal Cell Carcinoma',
                  shorthand: 'C6461008',
                  protocol: 'C6461008',
                  phase: 'Phase 1b/2',
                  sites: [ucsd('813550', 'McKay', 'Open cohorts: Arms A and B1')],
                },
                {
                  // placement: UCSD lists EXACT under "Metastatic, prior
                  // treatment", but its prior treatment is ADJUVANT — same setting
                  // as LITESPARK-033 above, so it sits with it under First line.
                  title:
                    'EXACT (HCRN GU22-595): Zanzalintinib (XL092) with Immunotherapy in Patients Who Progress on Adjuvant Therapy in Clear Cell RCC',
                  shorthand: 'EXACT',
                  protocol: 'HCRN GU22-595',
                  phase: 'Phase 2',
                  sites: [ucsd('812235', 'McKay')],
                },
                {
                  title:
                    'S2419 (BIOFRONT): Double-Blinded Trial of Immune-Based Therapy with a Live Biotherapeutic MO-03 or Placebo for Frontline Therapy of Advanced Clear Cell Renal Cell Carcinoma',
                  shorthand: 'BIOFRONT',
                  protocol: 'S2419',
                  phase: 'Phase 3',
                  setting: 'Frontline advanced or metastatic clear-cell RCC',
                  summary:
                    'Advanced or metastatic RCC with a clear-cell component, not amenable to curative surgery or radiation. No prior systemic therapy for advanced/metastatic disease and no prior immune-based combination therapy; prior neoadjuvant/adjuvant checkpoint therapy is allowed if more than 12 months before registration. RECIST 1.1 measurable or evaluable disease is required (bone-only or pleural-effusion-only disease is allowed); Zubrod 0–2. The patient must be eligible for an allowed first-line IO-IO or IO-TKI regimen, and IMDC favorable-risk patients must receive an IO-TKI regimen. No systemic antibiotics within 7 days before registration and no over-the-counter probiotic supplements during protocol treatment.',
                  sites: [usc('S2419', 'Sadeghi')],
                },
              ],
            },
            {
              label: '2nd & Beyond',
              kind: 'LINE_OF_THERAPY',
              tag: 'Line',
              trials: [
                {
                  title: 'HC366-RCC2311: HC-7366 (eIF4A inhibitor) + belzutifan',
                  shorthand: 'HC366-RCC2311',
                  protocol: 'HC366-RCC2311',
                  nct: 'NCT06234605',
                  phase: 'Phase 1b',
                  setting: 'Progressed after standard first-line treatment',
                  summary:
                    'A phase Ib study evaluating the safety, optimal dosing, and preliminary efficacy of HC-7366 (an eIF4A inhibitor) in combination with belzutifan in patients with locally advanced or metastatic clear-cell renal cell carcinoma.',
                  sites: [cedars('Posadas'), ucsd('809847', 'McKay', 'Combo cohort available only')],
                },
                {
                  title:
                    'ARC-PEAK: Casdatifan and Cabozantinib Versus Placebo and Cabozantinib in Advanced Clear Cell Renal Cell Carcinoma',
                  shorthand: 'ARC-PEAK',
                  phase: 'Phase 3',
                  sites: [ucsd('812233', 'McKay')],
                },
                {
                  title:
                    'NEO-811-101: First-in-Human Dose Escalation and Expansion Study of NEO-811 in Locally Advanced or Metastatic Non-Resectable Clear Cell RCC',
                  shorthand: 'NEO-811-101',
                  phase: 'Phase 1/2',
                  sites: [ucsd('813588', 'McKay')],
                },
                {
                  // placement: an all-solid-tumor study; UCSD lists it under RCC
                  // "Metastatic, prior treatment". Histology not specified.
                  title:
                    'INCA036873-101: Open-Label, Multicenter Study of INCA036873 in Advanced Solid Tumors and Hematological Malignancies',
                  shorthand: 'INCA036873-101',
                  phase: 'Phase 1',
                  sites: [ucsd('813929', 'Chen')],
                },
              ],
            },
          ],
        },
        {
          label: 'Non-clear cell',
          kind: 'BIOMARKER',
          tag: 'Histology',
          trials: [
            {
              title:
                'ETCTN BEAT: Bevacizumab, Erlotinib & Atezolizumab in Advanced HLRCC-Associated or Sporadic Papillary Renal Cell Cancer',
              shorthand: 'BEAT',
              phase: 'Phase 2',
              sites: [ucsd('812398', 'McKay')],
            },
          ],
        },
      ],
    },
  ],
};

// ─── OTHER GU — UCSD's own "Ancillary" and "Multiple" sections ─────────────
const OTHER_GU: CuratedNode = {
  label: 'Other GU Trials',
  kind: 'DISEASE_TYPE',
  tag: 'Other',
  children: [
    {
      label: 'Ancillary',
      kind: 'DISEASE_STATE',
      tag: 'Category',
      trials: [
        {
          title:
            'A092204: Cabozantinib With Cemiplimab Versus Cabozantinib Alone in Adolescents and Adults With Advanced Adrenocortical Cancer',
          shorthand: 'A092204',
          protocol: 'A092204',
          phase: 'Phase 2',
          sites: [ucsd('813740', 'Chen', COORDINATOR_TBD)],
        },
        {
          title:
            'IRONMAN: An International Registry to Improve Outcomes in Men with Advanced Prostate Cancer',
          shorthand: 'IRONMAN',
          phase: 'Registry',
          sites: [ucsd('170302', 'McKay', `PCCTC study. ${OPEN_HILLCREST}`)],
        },
        {
          // placement: an observational cohort that deliberately spans mCSPC
          // and mCRPC, so it belongs to neither prostate state node.
          title: 'LAPCC: Longitudinal Advanced Prostate Cancer Cohort',
          shorthand: 'LAPCC',
          phase: 'Observational cohort',
          setting: 'Broad metastatic prostate cancer',
          summary:
            'Metastatic prostate cancer including both mCSPC and mCRPC. Any treatment history; no specific PSA, molecular, or line-of-therapy restriction; participation in other trials is allowed.',
          sites: [usc('4P-22-2', 'Goldkorn', ALSO_LAG)],
        },
      ],
    },
    {
      label: 'Multiple GU cancers',
      kind: 'DISEASE_STATE',
      tag: 'Category',
      trials: [
        {
          title:
            'GU Collection: Clinical and Biospecimen Data to Assess Predictive and Prognostic Biomarkers in GU Malignancies',
          shorthand: 'GU Collection',
          phase: 'Biospecimen',
          sites: [ucsd('190443', 'McKay', OPEN_HILLCREST)],
        },
        {
          title: 'NIH 000048: A Multi-Center Natural History Study of Precision-Based Genomics in Prostate Cancer',
          shorthand: 'NIH 000048',
          phase: 'Natural history',
          summary:
            'Must have: PIK3 and/or AKT, PALB2, BRIP1, RAD50, RAD51, RAD54, RB1, SPOP, Wnt/B-catenin pathway, and MMR genes (MLH1, MSH2, MSH6, PMS2, EPCAM) and/or TMB-high, or be deemed an exceptional responder. Any platform for genomics testing is acceptable (research or CLIA-certified).',
          sites: [ucsd('804730', 'McKay')],
        },
        {
          title:
            'AGCT-1531: Active Surveillance for Low Risk and Randomized Carboplatin vs Cisplatin for Standard Risk Pediatric and Adult Germ Cell Tumors',
          shorthand: 'AGCT-1531',
          protocol: 'AGCT-1531',
          phase: 'Phase 3',
          sites: [ucsd('807305', 'Bagrodia', COORDINATOR_TBD)],
        },
        {
          // NOT the same trial as AGCT-1531 above: 1531 randomizes carboplatin
          // vs cisplatin in standard-risk disease, 1532 tests accelerated vs
          // standard BEP in intermediate/poor-risk disease. Keep them separate.
          title:
            'AGCT1532 (P3BEP): Randomised Trial of Accelerated Versus Standard BEP Chemotherapy for Patients with Intermediate and Poor-risk Metastatic Germ Cell Tumours',
          shorthand: 'P3BEP',
          protocol: 'AGCT1532',
          phase: 'Phase 3',
          setting: 'Newly diagnosed metastatic germ cell tumors',
          summary:
            'Intermediate- or poor-risk metastatic germ cell tumor requiring first-line chemotherapy. Age 11–50; IGCCC intermediate or poor risk; seminoma or nonseminoma of the testis, retroperitoneum, or mediastinum; also stage IV malignant ovarian germ cell tumor.',
          sites: [usc('AGCT1532', null, `${USC_PI_INITIAL}. ${ALSO_LAG}`)],
        },
        {
          title:
            'MAGESTIC: Phase II Trial of Serum Micro RNA-371 in Detecting Active Germ Cell Tumors in Patients with Suspected Regional Disease',
          shorthand: 'MAGESTIC',
          phase: 'Phase 2',
          setting: 'Early-stage or low-volume regional testicular germ cell tumors',
          summary:
            'Post-orchiectomy clinical stage I, stage I with isolated retroperitoneal relapse, or stage IIA/IIB with limited retroperitoneal nodes. Testicular seminoma or NSGCT; age 18+; AFP <50 ng/mL; beta-hCG <25 mIU/mL; no node >3 cm and no more than 2 enlarged retroperitoneal nodes.',
          sites: [usc('4T-22-2', 'Daneshmand')],
        },
        {
          title:
            'MOMA-313-001: MOMA-313 as Monotherapy or in Combination with a PARP Inhibitor in Advanced or Metastatic Solid Tumors',
          shorthand: 'MOMA-313-001',
          phase: 'Phase 1',
          sites: [ucsd('810837', 'McKay')],
        },
        {
          title:
            'PRISM (IIT Incyte): Retifanlimab and Ruxolitinib in Solid Malignancies Progressing on Prior Checkpoint Inhibition',
          shorthand: 'PRISM',
          phase: 'Phase 1b',
          sites: [ucsd('812209', 'McKay')],
        },
      ],
    },
  ],
};

/** Every tree, in display order. */
export const CURATED_TREES: CuratedNode[] = [PROSTATE, BLADDER, KIDNEY, OTHER_GU];
