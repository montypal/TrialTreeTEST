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
//   • City of Hope GU trial table (category, study title, NCT number, COH PI),
//     sent by email, September 2026
//
// The City of Hope list gives an NCT number for every row but no phase. Each
// NCT was looked up on ClinicalTrials.gov (29 Sep 2026) to confirm it is the
// study the list names, and the phase for City of Hope rows comes from that
// record. That lookup is also how eight rows were matched to trials already
// listed here for other centres: the record's sponsor protocol ID (C6461008,
// C6461006, NEO-811-101, CORE-008, EA8191, ...) matched the existing entry.
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

export type CenterSlug = 'cedars-sinai' | 'ucsd' | 'usc' | 'city-of-hope';

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
  /** What is being tested, as a physician would say it ("Belzutifan + pembrolizumab"). */
  intervention?: string;
  /**
   * Mechanism of the investigational agent(s), only ever as stated by the NCI
   * Thesaurus or the ClinicalTrials.gov record — never filled in from memory.
   */
  mechanism?: string;
  /** Where each mechanism came from: "NCIT:C135627" or "CTGOV:NCT01234567". */
  mechanismSources?: string[];
  /**
   * One sentence on what the study tests and why, paraphrased from the
   * ClinicalTrials.gov record (or from the list's title when there is no NCT).
   */
  brief?: string;
  /**
   * NCT numbers a curator has checked and ruled out for this trial. The
   * enrichment job will never link or propose them again.
   */
  rejectNct?: string[];
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

/** City of Hope rows carry the COH PI's surname and nothing else. */
const coh = (pi: string, notes?: string): CuratedSite =>
  notes ? { center: 'city-of-hope', pi, notes } : { center: 'city-of-hope', pi };

/**
 * Two City of Hope rows are listed as "active, not recruiting" on their
 * ClinicalTrials.gov record. The COH list is the source here, so they stay,
 * but the detail panel says so rather than letting them read as plainly open.
 */
const CTGOV_NOT_RECRUITING =
  'ClinicalTrials.gov listed this study as active, not recruiting on 29 Sep 2026; confirm availability with the study team';

const OPEN_HILLCREST = 'Open at Hillcrest';
// The UCSD list names no coordinator for these studies yet.
const COORDINATOR_TBD = 'Study coordinator not yet named on the UCSD list';
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
          intervention: 'Ezetimibe/simvastatin or ezetimibe (cholesterol lowering)',
          mechanism: 'Cholesterol absorption inhibitor + HMG-CoA reductase inhibitor',
          mechanismSources: ['NCIT:C123926', 'NCIT:C47529'],
          brief:
            'Tests whether intensive cholesterol lowering with ezetimibe/simvastatin (or ezetimibe alone) has anti-tumor immune-modulating activity in men with prostate cancer on active surveillance.',
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
          intervention: 'Urolithin A vs placebo before prostatectomy',
          mechanism: 'Mitophagy activator (potential antioxidant)',
          mechanismSources: ['NCIT:C199310'],
          brief:
            'Tests whether 3-6 weeks of urolithin A supplementation versus placebo before radical prostatectomy reduces tumor-tissue oxidative stress (8-OHdG) in men with prostate cancer.',
          sites: [cedars('Freedland')],
        },
        {
          title: 'PC-NET (pre-surgical epigenetic therapy): azacitidine x 5 days',
          shorthand: 'PC-NET',
          nct: 'NCT06888102',
          setting: 'Patients undergoing prostatectomy',
          summary:
            'Platform study looking at modulators of DNA methylation that promote sensitivity of prostate cancer to the immune system, used 1 month prior to prostatectomy.',
          phase: 'Early Phase 1', // from ClinicalTrials.gov; the list gives none
          intervention: 'Azacitidine (epigenetic therapy) before prostatectomy',
          mechanism: 'DNA methyltransferase inhibitor',
          mechanismSources: ['NCIT:C288'],
          brief:
            'Studies the safety, biomarkers and activity of neoadjuvant epigenetic therapy intended to sensitize tumors to the immune system in men with localized prostate cancer before radical prostatectomy.',
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
          intervention: '5-fraction SBRT vs standard-course EBRT',
          brief:
            'Compares five-fraction SBRT with usual 20-45-fraction radiation to test whether shorter treatment controls high-risk prostate cancer as well, measured by metastasis-free survival.',
          sites: [cedars('Ballas')],
        },
        {
          title: 'RAD-TARGET: Radiation Dose Tailoring Guided by Enhanced Targeting',
          shorthand: 'RAD-TARGET',
          // NCT matched on ClinicalTrials.gov (acronym RadTARGET, same drug, disease and phase).
          nct: 'NCT06990542',
          phase: 'Phase 2', // from ClinicalTrials.gov; the list gives none
          intervention: 'Tumor-focused radiotherapy vs standard whole-prostate RT',
          brief:
            'Compares image-guided, tumor-focused radiotherapy with standard whole-prostate radiotherapy in intermediate- or high-risk prostate cancer, testing whether lower dose to nearby organs reduces genitourinary and gastrointestinal toxicity.',
          sites: [ucsd('812494', 'Seibert', OPEN_HILLCREST)],
        },
        {
          title: 'BEFORE: Bladder Full or Empty for Pelvic Radiation Therapy',
          shorthand: 'BEFORE',
          // NCT matched on ClinicalTrials.gov (acronym BEFORE, same drug, disease and phase).
          nct: 'NCT06651697',
          phase: 'Phase 3', // from ClinicalTrials.gov; the list gives none
          intervention: 'Empty vs full bladder protocol for pelvic radiotherapy',
          brief:
            'Compares empty- versus full-bladder protocols for simulation and pelvic radiation therapy of genitourinary, gynecologic and gastrointestinal cancers, addressing limited prospective data on bladder-empty approaches.',
          sites: [ucsd('811100', 'Seibert', OPEN_HILLCREST)],
        },
        {
          title: 'SENTRY: Strategic Hormone Therapy and Targeted Radiotherapy',
          shorthand: 'SENTRY',
          // NCT matched on ClinicalTrials.gov (acronym SENTRY, same drug, disease and phase).
          nct: 'NCT07364071',
          phase: 'Phase 2', // from ClinicalTrials.gov; the list gives none
          intervention: '6-month ADT (± ARPI) vs 18-month ADT with radiotherapy',
          mechanism: 'Androgen suppression + androgen receptor pathway inhibitor',
          mechanismSources: ['NCIT:C15481', 'CTGOV:NCT07364071'],
          brief:
            'Compares 6-month versus standard 18-month androgen deprivation therapy with definitive radiotherapy for prostate cancer, testing whether shorter hormone therapy achieves comparable disease control.',
          sites: [ucsd('813314', 'Seibert')],
        },
        {
          title:
            'FOLATE: Phase II, Open-Label, Randomized Controlled Pilot Study Evaluating Trimethoprim in Patients Commencing Androgen Deprivation Therapy for Prostate Cancer',
          shorthand: 'FOLATE',
          phase: 'Phase 2',
          // NCT matched on ClinicalTrials.gov (UCSD IRB 812072 = CT.gov study ID; UCSD-sponsored, same title, PI Liss).
          nct: 'NCT06536374',
          intervention: 'Trimethoprim at the start of ADT',
          mechanism: 'Bacterial dihydrofolate reductase inhibitor',
          mechanismSources: ['NCIT:C908'],
          brief:
            'Evaluates trimethoprim in patients with prostate cancer commencing androgen deprivation therapy, in an open-label, randomized controlled phase II pilot study.',
          sites: [ucsd('812072', 'Liss')],
        },
        {
          // placement: UCSD lists this under "High-risk mHSPC", but the trial is
          // for LOCALIZED high-risk disease receiving radiotherapy.
          title:
            'EvoPAR02: Phase III Study of Adjuvant Saruparib (AZD5305) in Patients with BRCAm Localized High-Risk Prostate Cancer Receiving Radiotherapy with ADT',
          shorthand: 'EvoPAR02',
          phase: 'Phase 3',
          // NCT pending verification: likely NCT06952803, but no protocol-ID or acronym anchor confirms it.
          intervention: 'Saruparib (AZD5305) added to radiotherapy + ADT',
          mechanism: 'PARP inhibitor',
          mechanismSources: ['NCIT:C176783'],
          brief:
            'Tests adjuvant saruparib (AZD5305) in patients with BRCA-mutated localized high-risk prostate cancer receiving radiotherapy with androgen deprivation therapy, in a phase III study.',
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
          // NCT matched on ClinicalTrials.gov (USC study 4P-25-1 = CT.gov study ID; USC-sponsored, PI Abreu).
          nct: 'NCT07162194',
          intervention: 'Machine-learning vs radiologist MRI reading for biopsy',
          brief:
            'Tests whether machine-learning MRI reading is non-inferior to radiologist PI-RADS reading for targeting biopsies and detecting clinically significant prostate cancer in men undergoing prostate biopsy.',
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
          nct: 'NCT04423211',
          phase: 'Phase 3',
          intervention: 'PET-guided apalutamide ± metastasis-directed radiation',
          mechanism: 'Androgen receptor antagonist',
          mechanismSources: ['NCIT:C92574'],
          brief:
            'Tests whether apalutamide added to salvage radiation plus short-term ADT, and metastasis-directed radiation for PET-detected extrapelvic disease, prolong progression-free survival in post-prostatectomy biochemical recurrence.',
          sites: [
            ucsd(
              '210237',
              'Randall',
              `Open cohorts: Arms C and D (PET positive for extra-pelvic metastases). ${OPEN_HILLCREST}`,
            ),
            coh('Glaser'),
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
          intervention: 'Fasting-mimicking diet vs standard diet on ADT + ARPI',
          brief:
            'Tests whether a monthly fasting-mimicking diet versus a standard anti-cancer diet improves PSA response and metabolic outcomes in men on first-line intensified ADT for metastatic castration-sensitive prostate cancer.',
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
          intervention: 'Systemic therapy ± surgery or radiation to the primary',
          brief:
            'Tests whether adding radical prostatectomy or radiation of the primary tumor to standard systemic therapy improves overall survival in metastatic prostate cancer.',
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
          intervention: 'Mevrometostat + enzalutamide vs placebo + enzalutamide',
          mechanism: 'EZH2 inhibitor + androgen receptor inhibitor',
          mechanismSources: ['NCIT:C156743', 'NCIT:C71744'],
          brief:
            'Tests whether adding mevrometostat to enzalutamide outperforms enzalutamide plus placebo in ARPI-naive metastatic castration-sensitive prostate cancer not yet treated with chemotherapy for mCSPC.',
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
          intervention: 'Docetaxel + ADT + ARPI vs ADT + ARPI',
          mechanism: 'Microtubule inhibitor (taxane)',
          mechanismSources: ['NCIT:C1526'],
          brief:
            'Tests whether adding docetaxel to ADT plus an androgen receptor pathway inhibitor improves overall survival in metastatic castration-sensitive prostate cancer with suboptimal PSA response (≥0.2 ng/mL).',
          sites: [cedars('Posadas'), usc('CCTG-PR26', 'Pinski', ALSO_LAG)],
        },
        {
          title:
            'TERPS: Randomized Total Eradication of Metastatic Lesions Following Definitive Radiation to the Prostate in De Novo Oligometastatic Prostate Cancer',
          shorthand: 'TERPS',
          phase: 'Phase 2',
          // NCT matched on ClinicalTrials.gov (acronym TERPS in the official title; UCSD listed as a site).
          nct: 'NCT05223803',
          intervention: 'SABR to all metastases + prostate RT + systemic therapy',
          brief:
            'Tests whether adding stereotactic ablative radiation to all metastatic lesions, on top of systemic therapy and prostate radiation, improves outcomes in de novo oligometastatic prostate cancer.',
          sites: [ucsd('805523', 'Seibert', OPEN_HILLCREST)],
        },
        {
          title: 'TRITONS: Total Radiotherapy of Oligometastatic Cancers',
          shorthand: 'TRITONS',
          // NCT matched on ClinicalTrials.gov (acronym TRITONS, same drug, disease and phase).
          nct: 'NCT06587490',
          phase: 'Phase 3', // from ClinicalTrials.gov; the list gives none
          intervention: 'SABR to all metastases + standard care vs standard care',
          brief:
            'Compares stereotactic ablative radiotherapy plus standard-of-care therapy with standard care alone in oligometastatic solid cancers (up to 10 metastases), testing whether SABR prolongs progression-free survival.',
          sites: [ucsd('810616', 'Seibert', OPEN_HILLCREST)],
        },
        {
          // Not the same trial as Triple Switch (that is CCTG-PR26).
          title: 'A032302 (ASPIRE): Docetaxel Addition in Metastatic Castrate-Sensitive Prostate Cancer',
          shorthand: 'ASPIRE',
          protocol: 'A032302',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID A032302).
          nct: 'NCT06931340',
          phase: 'Phase 3', // from ClinicalTrials.gov; the list gives none
          intervention: 'Docetaxel + ADT + apalutamide vs ADT + apalutamide',
          mechanism: 'Microtubule inhibitor (taxane)',
          mechanismSources: ['NCIT:C1526'],
          brief:
            'Tests whether adding docetaxel to androgen deprivation therapy plus apalutamide improves overall survival in metastatic castration-sensitive prostate cancer.',
          sites: [ucsd('813502', 'Chen')],
        },
        {
          title: 'SIMCAP (Surgery in Metastatic Carcinoma of Prostate)',
          shorthand: 'SIMCAP',
          nct: 'NCT03456843',
          phase: 'Phase 2',
          intervention: 'Systemic therapy ± cytoreductive radical prostatectomy',
          brief:
            'Tests whether cytoreductive radical prostatectomy added to best systemic therapy improves oncologic and quality-of-life outcomes in men with newly diagnosed metastatic prostate cancer.',
          sites: [coh('Yuh', CTGOV_NOT_RECRUITING)],
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
          intervention: 'Carotuximab + enzalutamide/apalutamide vs AR blockade',
          mechanism: 'Anti-endoglin (CD105) antibody + androgen receptor inhibitor',
          mechanismSources: ['NCIT:C74010', 'NCIT:C71744', 'NCIT:C92574'],
          brief:
            'Compares progression-free survival with AR blockade (enzalutamide or apalutamide) with versus without carotuximab in metastatic castration-resistant prostate cancer that progressed on androgen receptor signaling inhibitor therapy.',
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
          intervention: 'Ifinatamab deruxtecan vs docetaxel',
          mechanism: 'B7-H3-directed antibody-drug conjugate',
          mechanismSources: ['NCIT:C171577'],
          brief:
            'Tests whether ifinatamab deruxtecan improves overall and radiographic progression-free survival versus docetaxel in metastatic castration-resistant prostate cancer after 1-2 androgen receptor pathway inhibitors, without prior taxane for mCRPC.',
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
          intervention: 'Pasritamig ± JNJ-87189401 vs placebo',
          mechanism: 'KLK2 × CD3 bispecific T-cell engager + PSMA × CD28 bispecific antibody',
          mechanismSources: ['NCIT:C180825', 'NCIT:C202466'],
          brief:
            'Tests whether pasritamig, alone or with JNJ-87189401, plus best supportive care improves overall survival versus placebo in late-line metastatic castration-resistant prostate cancer after available life-prolonging therapies.',
          sites: [cedars('Posadas'), ucsd('812903', 'Chen')],
        },
        {
          title: 'A032102 (PREDICT): Precision Diagnostics in Prostate Cancer Treatment',
          shorthand: 'PREDICT',
          protocol: 'A032102',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID A032102).
          nct: 'NCT06632977',
          phase: 'Phase 2', // from ClinicalTrials.gov; the list gives none
          intervention: 'Biomarker-assigned valemetostat or carboplatin + cabazitaxel',
          mechanism: 'EZH1/2 inhibitor + platinum compound + microtubule inhibitor (taxane)',
          mechanismSources: ['NCIT:C168589', 'NCIT:C1282', 'NCIT:C66937'],
          brief:
            'Evaluates whether DNA/RNA genetic testing helps assign patients with metastatic castration-resistant prostate cancer to matched treatment: valemetostat, carboplatin plus cabazitaxel, or physician\'s choice.',
          sites: [ucsd('811522', 'McKay', `All arms open. ${OPEN_HILLCREST}`)],
        },
        {
          title:
            'CONVERGE-01: Dosimetry, Randomized Dose Optimization, Dose Escalation and Efficacy of Ac-225 Rosopatamab Tetraxetan in PSMA PET-Positive Castration-Resistant Prostate Cancer',
          shorthand: 'CONVERGE-01',
          phase: 'Phase 2',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID CONVERGE-01).
          nct: 'NCT06549465',
          intervention: 'Ac-225 rosopatamab tetraxetan',
          mechanism: 'PSMA-directed alpha-emitting radioimmunoconjugate',
          mechanismSources: ['NCIT:C153159'],
          brief:
            'Evaluates safety, dosimetry, dose optimization and efficacy of Ac-225 rosopatamab tetraxetan, a PSMA-directed radioantibody, in PSMA PET-positive castration-resistant prostate cancer, including after prior Lu-177-PSMA therapy.',
          sites: [ucsd('810603', 'McKay', OPEN_HILLCREST)],
        },
        {
          title:
            'ACE-232-001: Safety, Pharmacokinetics, Pharmacodynamics, and Preliminary Efficacy of ACE-232 in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'ACE-232-001',
          phase: 'Phase 1',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID ACE-232-001).
          nct: 'NCT06801236',
          intervention: 'ACE-232',
          mechanism: 'CYP11A1 inhibitor',
          mechanismSources: ['NCIT:C215027'],
          brief:
            'Evaluates safety, tolerability, pharmacokinetics and preliminary efficacy of oral ACE-232 in metastatic castration-resistant prostate cancer, to find the maximum tolerated and recommended phase 2 doses.',
          sites: [ucsd('812159', 'McKay')],
        },
        {
          title:
            'MK-5684-01A: Umbrella Substudy of MK-5684-based Treatment Combinations or MK-5684 Alone in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'MK-5684-01A',
          phase: 'Phase 1/2',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID 5684-01A).
          nct: 'NCT06353386',
          intervention: 'Opevesostat (MK-5684) ± olaparib, docetaxel or cabazitaxel',
          mechanism: 'CYP11A1 inhibitor + PARP inhibitor + microtubule inhibitor (taxane)',
          mechanismSources: ['NCIT:C156744', 'NCIT:C71721', 'NCIT:C1526', 'NCIT:C66937'],
          brief:
            'Evaluates safety and efficacy of opevesostat (MK-5684) alone or combined with olaparib, docetaxel or cabazitaxel in metastatic castration-resistant prostate cancer, establishing recommended phase 2 combination doses.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID c24-349).
          nct: 'NCT06844383',
          intervention: 'Talazoparib alone vs talazoparib + enzalutamide',
          mechanism: 'PARP inhibitor',
          mechanismSources: ['NCIT:C95733'],
          brief:
            'Tests whether talazoparib alone or with enzalutamide delays progression in metastatic castration-resistant prostate cancer with HRR mutations after prior abiraterone or darolutamide.',
          sites: [ucsd('813246', 'McKay')],
        },
        {
          title:
            'DS3201-343: Valemetostat (DS-3201) in Combination with Darolutamide in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'DS3201-343',
          phase: 'Phase 1',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID DS3201-343).
          nct: 'NCT07244341',
          intervention: 'Valemetostat + darolutamide',
          mechanism: 'EZH1/EZH2 inhibitor + androgen receptor antagonist',
          mechanismSources: ['NCIT:C127114', 'NCIT:C104748'],
          brief:
            'Evaluates the safety, tolerability and efficacy of valemetostat combined with darolutamide, through dose escalation and expansion, in metastatic castration-resistant prostate cancer.',
          sites: [ucsd('813462', 'McKay')],
        },
        {
          title:
            'GSK 300164 (PROTAC): First-in-Human Dose Escalation and Dose Optimization Study of GSK5471713 in Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'GSK 300164',
          phase: 'Phase 1/2',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID 300164).
          nct: 'NCT07332455',
          intervention: 'GSK5471713',
          mechanism: 'Androgen receptor degrader',
          mechanismSources: ['NCIT:C227496'],
          brief:
            'Evaluates the safety, tolerability, pharmacokinetics and preliminary clinical activity of GSK5471713 monotherapy in a first-in-human dose-escalation and dose-optimization study in metastatic castration-resistant prostate cancer.',
          sites: [ucsd('814157', 'McKay')],
        },
        {
          title:
            'KLK2-PASenger (78278343PCR3003): Pasritamig (JNJ-78278343) With Docetaxel Versus Docetaxel for Metastatic Castration-Resistant Prostate Cancer',
          shorthand: 'KLK2-PASenger',
          protocol: '78278343PCR3003',
          phase: 'Phase 3',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID 78278343PCR3003).
          nct: 'NCT07225946',
          intervention: 'Pasritamig + docetaxel vs docetaxel',
          mechanism: 'KLK2 × CD3 bispecific T-cell engager',
          mechanismSources: ['NCIT:C180825'],
          brief:
            'Tests whether adding pasritamig to docetaxel prolongs radiographic progression-free survival compared with docetaxel alone in metastatic castration-resistant prostate cancer.',
          sites: [ucsd('813463', 'McKay'), usc('4P-25-4', null, `${USC_PI_INITIAL}. ${ALSO_LAG}`)],
        },
        {
          title:
            'TIDAL (PCCTC/MSKCC #c24-347): Tarlatamab in Delta-like Protein 3 (DLL3) Positive Metastatic Prostate Cancer',
          shorthand: 'TIDAL',
          protocol: 'PCCTC c24-347',
          phase: 'Phase 2',
          // NCT matched on ClinicalTrials.gov (CT.gov secondary ID "PCCTC #: c24-347").
          nct: 'NCT07111507',
          intervention: 'Tarlatamab',
          mechanism: 'DLL3 × CD3 bispecific T-cell engager',
          mechanismSources: ['NCIT:C175858'],
          brief:
            'Tests whether tarlatamab is an effective treatment for relapsed or refractory DLL3-positive metastatic prostate cancer.',
          sites: [ucsd('813461', 'McKay')],
        },
        {
          title: 'JANX014: Open-Label, Multicenter Study of JANX014 in Participants with Prostate Cancer',
          shorthand: 'JANX014',
          phase: 'Phase 1',
          // NCT pending verification: likely NCT07545811, but no protocol-ID or acronym anchor confirms it.
          intervention: 'JANX014',
          mechanism: 'PSMA × CD3 tumor-activated masked T-cell engager',
          mechanismSources: ['NCIT:C228077'],
          brief:
            'Evaluates JANX014 in an open-label, multicenter phase 1 study of participants with prostate cancer.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID PSMA-007-001).
          nct: 'NCT05519449',
          intervention: 'JANX007 ± darolutamide',
          mechanism: 'PSMA × CD3 protease-activated T-cell engager',
          mechanismSources: ['NCIT:C190729', 'NCIT:C104748'],
          brief:
            'Evaluates the safety, tolerability, pharmacokinetics and preliminary efficacy of JANX007, alone or with darolutamide, in a first-in-human study in metastatic castration-resistant prostate cancer.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID 10487).
          nct: 'NCT05691465',
          intervention: 'Lutetium Lu 177 dotatate',
          mechanism: 'Somatostatin receptor-targeted radioligand',
          mechanismSources: ['NCIT:C95020'],
          brief:
            'Tests how well lutetium Lu 177 dotatate, a radioactive drug that binds somatostatin receptors, works in metastatic prostate cancer with neuroendocrine differentiation.',
          sites: [usc('4P-23-6', 'Pinski')],
        },
        {
          title: 'ANDROMEDA (AZD9750)',
          shorthand: 'ANDROMEDA',
          nct: 'NCT07336446',
          phase: 'Phase 1/2',
          intervention: 'AZD9750 ± saruparib (AZD5305)',
          mechanism: 'Androgen receptor PROTAC degrader + PARP1-selective inhibitor',
          mechanismSources: ['NCIT:C224903', 'CTGOV:NCT07336446'],
          brief:
            'Evaluates safety, pharmacokinetics and preliminary efficacy of AZD9750 alone and with saruparib in this first-in-human study in metastatic prostate cancer after prior ARPI therapy.',
          sites: [coh('Nguyen')],
        },
        {
          title: 'FG-3246 Dose Optimization Trial',
          shorthand: 'FG-3246',
          nct: 'NCT06842498',
          phase: 'Phase 2',
          intervention: 'FG-3246 dose optimization (1.8, 2.4 or 2.7 mg/kg)',
          mechanism: 'CD46-directed antibody-drug conjugate',
          mechanismSources: ['NCIT:C156416'],
          brief:
            'Compares three FG-3246 doses to optimize dosing of this CD46-targeting antibody-drug conjugate in metastatic castration-resistant prostate cancer after one prior ARSI and no taxane for mCRPC.',
          sites: [coh('Shadad')],
        },
        {
          title: 'PSCA CAR-T Combination Study',
          shorthand: 'PSCA CAR-T',
          nct: 'NCT05805371',
          phase: 'Phase 1',
          intervention: 'PSCA CAR T cells ± metastasis-directed radiation',
          mechanism: 'PSCA-directed CAR T-cell therapy',
          mechanismSources: ['NCIT:C157746'],
          brief:
            'Tests the feasibility, safety and activity of PSCA-targeting CAR T cells after lymphodepletion, alone or with metastasis-directed radiation, in PSCA-positive metastatic castration-resistant prostate cancer.',
          sites: [coh('Dorff')],
        },
        {
          title: 'REGN15505 (PSMAx4-1BB) ± Cemiplimab/REGN4336',
          shorthand: 'REGN15505',
          nct: 'NCT07594106',
          phase: 'Phase 1/2',
          intervention: 'REGN15505 ± cemiplimab or olsutamig (REGN4336)',
          mechanism: 'PSMA × 4-1BB bispecific + PD-1 inhibitor + PSMA × CD3 bispecific',
          mechanismSources: ['NCIT:C227968', 'NCIT:C121540', 'NCIT:C185664'],
          brief:
            'Studies the safety, activity and best dose of REGN15505 alone or with cemiplimab or REGN4336 in metastatic castration-resistant prostate cancer and clear cell renal cell carcinoma.',
          sites: [coh('Chehrazi-Raffle')],
        },
        {
          title: 'RECIPROCAL',
          shorthand: 'RECIPROCAL',
          nct: 'NCT07200830',
          phase: 'Phase 3',
          intervention: 'Lu-177 vipivotide tetraxetan: adaptive vs standard dosing',
          mechanism: 'PSMA-targeted radioligand',
          mechanismSources: ['NCIT:C148145'],
          brief:
            'Tests whether adaptively lengthening the dosing interval of lutetium Lu 177 vipivotide tetraxetan after two doses improves quality of life without shortening survival in metastatic castration-resistant prostate cancer.',
          sites: [coh('Stadler')],
        },
        {
          title: 'AB-3028-201',
          shorthand: 'AB-3028-201',
          protocol: 'AB-3028-201',
          nct: 'NCT07285694',
          phase: 'Phase 1/2',
          intervention: 'AB-3028 (logic-gated PSMA CAR T cells)',
          mechanism: 'Priming antigen-inducible PSMA CAR T-cell therapy',
          mechanismSources: ['NCIT:C224969'],
          brief:
            'Evaluates the safety, recommended phase 2 dose and efficacy of a single infusion of AB-3028 logic-gated T cells in PSMA-positive metastatic castration-resistant prostate cancer after prior ARPI.',
          sites: [coh('Dorff', CTGOV_NOT_RECRUITING)],
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
          intervention: 'Bicalutamide before TURBT vs TURBT alone',
          mechanism: 'Nonsteroidal antiandrogen',
          mechanismSources: ['NCIT:C1599'],
          brief:
            'Tests whether bicalutamide before TURBT, versus no study drug, changes EGFR expression in adjacent urothelium of men with non-muscle-invasive bladder cancer, since EGFR is linked to progression.',
          sites: [cedars(null)],
        },
        {
          title:
            'QUILT-2.005: Intravesical BCG in Combination With ALT-803 (N-803) in Patients With Non-Muscle Invasive Bladder Cancer',
          shorthand: 'QUILT-2.005',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID "CA-ALT-803-01-14; QUILT-2.005").
          nct: 'NCT02138734',
          phase: 'Phase 1/2', // from ClinicalTrials.gov; the list gives none
          intervention: 'Nogapendekin alfa inbakicept (N-803) + BCG vs BCG',
          mechanism: 'IL-15 receptor agonist',
          mechanismSources: ['NCIT:C205507'],
          brief:
            'Compares intravesical N-803 plus BCG with BCG alone in BCG-naive patients with high-grade non-muscle-invasive bladder cancer, in a phase Ib/IIb randomized study.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID NRG-GU014).
          nct: 'NCT06770582',
          intervention: 'Pembrolizumab + radiation vs chemoradiation',
          mechanism: 'PD-1 inhibitor',
          mechanismSources: ['NCIT:C106432'],
          brief:
            'Compares pembrolizumab plus radiation with radiation plus concurrent chemotherapy (cisplatin, gemcitabine, or mitomycin/5-FU) for high-grade T1 non-muscle-invasive bladder cancer.',
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
          // NCT matched on ClinicalTrials.gov (acronym ABLE-22, same drug, disease and phase).
          nct: 'NCT06545955',
          intervention: 'Nadofaragene firadenovec ± gemcitabine/docetaxel',
          mechanism: 'Replication-deficient adenovirus encoding interferon alpha-2b',
          mechanismSources: ['NCIT:C71011', 'NCIT:C66876', 'NCIT:C1526', 'NCIT:C106432'],
          brief:
            'Evaluates the safety and efficacy of intravesical nadofaragene firadenovec alone or with intravesical gemcitabine/docetaxel in high-grade BCG-unresponsive NMIBC with carcinoma in situ.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID CRETO-EAP).
          nct: 'NCT06443944',
          intervention: 'Cretostimogene grenadenorepvec (expanded access)',
          mechanism: 'GM-CSF-expressing oncolytic adenovirus',
          mechanismSources: ['NCIT:C48412', 'NCIT:C175914'],
          brief:
            'Offers expanded access to cretostimogene grenadenorepvec for patients with BCG-unresponsive non-muscle-invasive bladder cancer, specifically carcinoma in situ with or without high-grade Ta/T1.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID EG-70-101).
          nct: 'NCT04752722',
          intervention: 'Detalimogene voraplasmid (EG-70)',
          mechanism: 'Non-viral plasmid DNA vector encoding IL-12 and a RIG-I activator',
          mechanismSources: ['NCIT:C179685'],
          brief:
            'Evaluates the safety and efficacy of intravesical detalimogene voraplasmid (EG-70) in BCG-unresponsive NMIBC with carcinoma in situ and in BCG-naive or incompletely BCG-treated high-risk NMIBC.',
          sites: [usc('4B-22-2', 'Schuckman')],
        },
        {
          title:
            'CORE-008: Multi-arm, Multi-cohort, Open-label Study of Cretostimogene Grenadenorepvec in Participants with High-risk Non-muscle-invasive Bladder Cancer',
          shorthand: 'CORE-008',
          nct: 'NCT06567743',
          phase: 'Phase 2',
          setting: 'High-risk NMIBC — cohort-specific BCG settings',
          summary:
            'High-risk NMIBC with CIS with or without Ta/T1, or papillary high-grade Ta/T1. Eligibility and cystectomy requirements are cohort-specific across BCG-naive, BCG-exposed, and BCG-unresponsive populations.',
          intervention: 'Cretostimogene grenadenorepvec ± intravesical gemcitabine',
          mechanism: 'GM-CSF-expressing oncolytic adenovirus + antimetabolite',
          mechanismSources: ['NCIT:C48412', 'NCIT:C66876'],
          brief:
            'Evaluates safety and efficacy of intravesical cretostimogene grenadenorepvec, given by current or alternative instillation methods or with gemcitabine, in BCG-naive, BCG-exposed or BCG-unresponsive high-risk non-muscle-invasive bladder cancer.',
          sites: [usc('4B-24-4', 'Daneshmand'), coh('Hugen')],
        },
        {
          title:
            'INTerpath-011: Open-label Randomized Study of V940 in Combination With BCG Versus BCG Monotherapy in Participants With High-risk Non-muscle Invasive Bladder Cancer',
          shorthand: 'INTerpath-011',
          phase: 'Phase 2',
          setting: 'BCG-naive high-risk NMIBC',
          summary:
            'BCG-naive high-risk NMIBC: T1, large or multifocal high-grade Ta, or CIS with or without papillary disease. The main cohort is BCG-naive; CIS is not required and cystectomy is not the central matching criterion.',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID INTerpath-011).
          nct: 'NCT06833073',
          intervention: 'Intismeran autogene (V940) + BCG vs BCG',
          mechanism: 'mRNA-based individualized cancer vaccine',
          mechanismSources: ['NCIT:C146813'],
          brief:
            'Tests whether adding intismeran autogene (V940) to BCG improves event-free survival versus BCG alone in BCG-naive high-risk non-muscle-invasive bladder cancer.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID ResQ132EX-NMIBC).
          nct: 'NCT06810141',
          intervention: 'Recombinant BCG (rMBCG) expanded access',
          mechanism: 'Recombinant BCG (non-specific immunotherapy)',
          mechanismSources: ['NCIT:C222545'],
          brief:
            'Offers recombinant BCG (rMBCG) to patients with non-muscle-invasive bladder cancer eligible for TICE BCG who cannot join an rMBCG trial; BCG-naive patients only if TICE is unavailable.',
          sites: [usc('4B-25-6', 'Daneshmand', ALSO_LAG)],
        },
        {
          title: 'Blue Light Cystoscopy with Cysview (BLC with Cysview) Registry',
          shorthand: 'BLC with Cysview',
          phase: 'Registry',
          setting: 'NMIBC diagnosis and surveillance',
          summary:
            'Suspected or known NMIBC in diagnostic or surveillance care; CIS, Ta, and T1 may be represented. BCG exposure and cystectomy status are not defining criteria.',
          // NCT pending verification: likely NCT02660645, but no protocol-ID or acronym anchor confirms it.
          intervention: 'Blue-light cystoscopy (Cysview) registry',
          brief:
            'Collects registry data on blue light cystoscopy with Cysview in non-muscle-invasive bladder cancer diagnosis and surveillance.',
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
          // NCT matched on ClinicalTrials.gov (acronym Nova-sTAR, same drug, disease and phase).
          nct: 'NCT07309445',
          intervention: 'Real-world TAR-200 outcomes study',
          mechanism: 'Intravesical gemcitabine-releasing system',
          mechanismSources: ['NCIT:C150807'],
          brief:
            'Studies how well TAR-200 works in routine US practice, measuring disease-free survival from first insertion in patients with non-muscle-invasive bladder cancer.',
          sites: [usc('4B-26-1', 'Daneshmand')],
        },
        {
          title: 'Nadofaragene Firadenovec vs Observation (ABLE-32)',
          shorthand: 'ABLE-32',
          nct: 'NCT06510374',
          phase: 'Phase 3',
          intervention: 'Nadofaragene firadenovec vs observation',
          mechanism: 'Replication-deficient adenovirus encoding interferon alpha-2b',
          mechanismSources: ['NCIT:C71011'],
          brief:
            'Tests whether quarterly nadofaragene firadenovec instillations for 24 months improve recurrence-free survival versus guideline observation after TURBT in intermediate-risk non-muscle-invasive bladder cancer.',
          sites: [coh('Rabbani')],
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
          intervention: 'Neoadjuvant chemo ± IO, then trimodal therapy',
          brief:
            'Tests whether trimodal therapy can be delivered within 45 days of neoadjuvant chemotherapy ± immunotherapy in muscle-invasive bladder cancer with variant histology, a group lacking prospective TMT data.',
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
          intervention: 'Pembrolizumab + radiation for bladder preservation',
          mechanism: 'PD-1 inhibitor',
          mechanismSources: ['NCIT:C106432'],
          brief:
            'Tests whether pembrolizumab plus radiation can preserve the bladder, avoiding cystectomy, in muscle-invasive bladder cancer with a clinically meaningful response to neoadjuvant therapy.',
          sites: [cedars('Ballas'), usc('S2427', 'Daneshmand'), coh('Tripathi')],
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
          intervention: '5-fraction vs 20-fraction chemoradiation',
          brief:
            'Tests whether 5-fraction ultra-hypofractionated (SBRT) chemoradiation is non-inferior to usual 20-fraction hypofractionated chemoradiation for bladder-intact event-free survival in muscle-invasive bladder cancer.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID A032103).
          nct: 'NCT05987241',
          intervention: 'Relatlimab + nivolumab vs nivolumab, ctDNA-guided',
          mechanism: 'LAG-3-directed monoclonal antibody',
          mechanismSources: ['NCIT:C111999'],
          brief:
            'Tests whether post-surgery ctDNA testing can guide adjuvant immunotherapy in urothelial cancer: nivolumab ± relatlimab if ctDNA-positive; immediate nivolumab vs ctDNA surveillance if ctDNA-negative.',
          sites: [ucsd('810099', 'Stewart')],
        },
        {
          title: 'HCRN GU22-598 (EV + Pembrolizumab)',
          shorthand: 'HCRN GU22-598',
          protocol: 'HCRN GU22-598',
          nct: 'NCT06809140',
          phase: 'Phase 2',
          intervention: 'Enfortumab vedotin + pembrolizumab, bladder sparing',
          mechanism: 'Nectin-4-directed ADC + PD-1 inhibitor',
          mechanismSources: ['NCIT:C114500', 'NCIT:C106432'],
          brief:
            'Tests enfortumab vedotin plus pembrolizumab with selective bladder sparing in muscle-invasive bladder cancer, giving maintenance to clinical complete responders and cystectomy for residual disease.',
          sites: [coh('Tripathi')],
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID EA8192).
          nct: 'NCT04628767',
          intervention: 'Durvalumab + aMVAC vs aMVAC before nephroureterectomy',
          mechanism: 'PD-L1 inhibitor',
          mechanismSources: ['NCIT:C103194', 'NCIT:C961'],
          brief:
            'Tests whether adding durvalumab to neoadjuvant aMVAC chemotherapy improves event-free survival versus aMVAC alone before nephroureterectomy in cisplatin-eligible high-grade upper tract urothelial cancer.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID TYR300-203).
          nct: 'NCT07265947',
          intervention: 'Dabogratinib (TYRA-300)',
          mechanism: 'Selective FGFR3 inhibitor',
          mechanismSources: ['NCIT:C190779'],
          brief:
            'Evaluates the efficacy and safety of oral dabogratinib (TYRA-300) in low-grade upper tract urothelial carcinoma, with complete response within 6 months in FGFR3-positive participants as primary endpoint.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID DS1062-328).
          nct: 'NCT07129993',
          intervention: 'Datopotamab deruxtecan + platinum vs gemcitabine + platinum',
          mechanism: 'TROP2-directed antibody-drug conjugate',
          mechanismSources: ['NCIT:C151967'],
          brief:
            'Compares datopotamab deruxtecan plus platinum versus gemcitabine plus platinum in locally advanced or metastatic urothelial carcinoma that progressed during or after enfortumab vedotin plus pembrolizumab.',
          sites: [ucsd('812234', 'Stewart')],
        },
        {
          title:
            'NCI ETCTN 10636: CA-4948 With Pembrolizumab to Overcome Resistance to PD-1/PD-L1 Blockade in Metastatic Urothelial Cancer',
          shorthand: 'ETCTN 10636',
          protocol: 'ETCTN 10636',
          nct: 'NCT06439836',
          phase: 'Phase 1',
          intervention: 'Emavusertib (CA-4948) + pembrolizumab',
          mechanism: 'IRAK4 inhibitor + PD-1 inhibitor',
          mechanismSources: ['NCIT:C148455', 'NCIT:C106432'],
          brief:
            'Tests the safety, best dose, and activity of emavusertib (CA-4948) plus pembrolizumab to overcome PD-1/PD-L1 blockade resistance in metastatic urothelial cancer after prior immunotherapy.',
          sites: [ucsd('812410', 'Stewart'), coh('Tripathi')],
        },
        {
          title:
            'C6461006: PF-08634404 Monotherapy or in Combination with Enfortumab Vedotin in Locally Advanced or Metastatic Urothelial Cancer',
          shorthand: 'C6461006',
          protocol: 'C6461006',
          nct: 'NCT07421700',
          phase: 'Phase 1b/2',
          intervention: 'PF-08634404 ± enfortumab vedotin',
          mechanism: 'PD-1 × VEGF bispecific antibody + Nectin-4-directed ADC',
          mechanismSources: ['NCIT:C223904', 'NCIT:C114500'],
          brief:
            'Evaluates PF-08634404 alone in previously treated, or with enfortumab vedotin in untreated, locally advanced or metastatic urothelial cancer, assessing safety, antitumor activity, and pharmacokinetics.',
          sites: [ucsd('813624', 'Stewart'), coh('Tripathi')],
        },
        {
          title:
            'LOXO-LNC-24001: LY4052031, a Nectin-4 Antibody-Drug Conjugate, in Advanced or Metastatic Urothelial Carcinoma or Other Solid Tumors',
          shorthand: 'LOXO-LNC-24001',
          phase: 'Phase 1a/1b',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID LOXO-LNC-24001).
          nct: 'NCT06465069',
          intervention: 'LY4052031',
          mechanism: 'Nectin-4-directed antibody-drug conjugate',
          mechanismSources: ['NCIT:C209887'],
          brief:
            'Evaluates the safety, recommended phase 2 dose, and antitumor activity of LY4052031, a nectin-4-directed antibody-drug conjugate, in advanced or metastatic urothelial carcinoma and other solid tumors.',
          sites: [ucsd('814162', 'Stewart', COORDINATOR_TBD)],
        },
        {
          // placement: City of Hope lists this under Bladder – Metastatic; the
          // study itself enrolls several HER2-expressing solid tumours.
          title: 'BL-M07D1 HER2 Study',
          shorthand: 'BL-M07D1',
          nct: 'NCT06293898',
          phase: 'Phase 1',
          intervention: 'BL-M07D1',
          mechanism: 'HER2-directed ADC',
          mechanismSources: ['NCIT:C189821'],
          brief:
            'Evaluates the safety, tolerability, pharmacokinetics, and efficacy of BL-M07D1 in HER2-expressing advanced solid tumors, including urothelial carcinoma.',
          sites: [coh('Tripathi')],
        },
        {
          // placement: City of Hope lists this under Bladder – Metastatic; the
          // study itself enrolls several solid tumour types.
          title: 'AKY-1189 (NECTINIUM-2)',
          shorthand: 'AKY-1189',
          nct: 'NCT07020117',
          phase: 'Phase 1',
          intervention: '[225Ac]Ac-AKY-1189',
          mechanism: 'Nectin-4-targeted actinium-225 radioconjugate',
          mechanismSources: ['NCIT:C222056'],
          brief:
            'Tests the safety, efficacy, and recommended phase 2 dose of the Nectin-4 radiopharmaceutical [225Ac]Ac-AKY-1189 in previously treated locally advanced or metastatic solid tumors, including urothelial carcinoma.',
          sites: [coh('Tripathi')],
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID 89Zr-TLX250-007).
          nct: 'NCT06090331',
          intervention: '89Zr-girentuximab PET/CT (expanded access)',
          mechanism: 'CAIX-targeted PET imaging agent (radiolabeled antibody)',
          mechanismSources: ['NCIT:C118295'],
          brief:
            'Offers zirconium Zr 89 girentuximab PET/CT to non-invasively detect CAIX-expressing clear cell renal cell carcinoma in patients with renal masses seen on conventional imaging.',
          sites: [usc('4K-24-1', 'Conti')],
        },
      ],
      children: [
        {
          label: 'Clear cell',
          kind: 'BIOMARKER',
          tag: 'Histology',
          children: [
            {
              label: 'Neoadjuvant',
              kind: 'LINE_OF_THERAPY',
              tag: 'Line',
              trials: [
                {
                  title: 'Ivonescimab Prior to Surgery for High-Risk Localized Clear Cell RCC',
                  shorthand: 'Ivonescimab',
                  nct: 'NCT07226544',
                  phase: 'Phase 2',
                  intervention: 'Neoadjuvant ivonescimab before nephrectomy',
                  mechanism: 'PD-1 × VEGF bispecific antibody',
                  mechanismSources: ['NCIT:C184865'],
                  brief:
                    'Tests whether neoadjuvant ivonescimab before standard nephrectomy can shrink tumors in high-risk localized clear cell renal cell carcinoma.',
                  sites: [coh('Pal')],
                },
              ],
            },
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
                  intervention: 'Tivozanib + pembrolizumab vs pembrolizumab',
                  mechanism: 'VEGFR inhibitor',
                  mechanismSources: ['NCIT:C85444'],
                  brief:
                    'Compares adding short-term tivozanib to adjuvant pembrolizumab versus pembrolizumab alone after surgical removal of all known disease in high-risk renal cell carcinoma.',
                  sites: [cedars('Posadas'), ucsd('812777', 'McKay'), usc('A032201', 'Tulpule', ALSO_LAG)],
                },
                {
                  title:
                    'Adding a Probiotic (CBM588) to Pembrolizumab for the Treatment of Renal Cell Cancer After Surgery',
                  shorthand: 'CBM588 + pembrolizumab',
                  nct: 'NCT07037004',
                  phase: 'Phase 2',
                  intervention: 'CBM588 + pembrolizumab vs pembrolizumab',
                  mechanism: 'Gut microbiome-modulating probiotic',
                  mechanismSources: ['NCIT:C154674'],
                  brief:
                    'Compares adding the live biotherapeutic CBM588 to adjuvant pembrolizumab versus pembrolizumab alone for preventing recurrence after resection of high-risk renal cell carcinoma.',
                  sites: [coh('Pal')],
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
                  intervention: 'Belzutifan + zanzalintinib vs cabozantinib',
                  mechanism: 'HIF-2α inhibitor + c-Met/VEGFR2/AXL/MER tyrosine kinase inhibitor',
                  mechanismSources: ['NCIT:C135627', 'NCIT:C161598'],
                  brief:
                    'Compares belzutifan plus zanzalintinib versus cabozantinib for survival in advanced renal cell carcinoma that recurred during or after adjuvant anti-PD-1/PD-L1 therapy.',
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
                  intervention: 'Cytoreductive nephrectomy + immunotherapy vs immunotherapy',
                  brief:
                    'Tests whether adding cytoreductive nephrectomy to standard immunotherapy-based combination therapy works better than systemic therapy alone in metastatic renal cell carcinoma, where its benefit is debated.',
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
                  intervention: 'SABR to primary kidney tumor + immunotherapy',
                  brief:
                    'Tests whether adding stereotactic ablative radiation to the primary kidney tumor improves outcomes of standard immunotherapy in metastatic renal cell carcinoma not recommended for surgery.',
                  sites: [cedars('Ballas'), ucsd('805760', 'Seibert', OPEN_HILLCREST)],
                },
                {
                  title:
                    'ARC-20: Dose Escalation and Expansion Study of AB521 Monotherapy and Combination Therapies in Clear Cell Renal Cell Carcinoma and Other Solid Tumors',
                  shorthand: 'ARC-20',
                  phase: 'Phase 1',
                  // NCT matched on ClinicalTrials.gov (CT.gov study ID ARC-20).
                  nct: 'NCT05536141',
                  intervention: 'Casdatifan ± cabozantinib or zimberelimab (± ipilimumab)',
                  mechanism: 'HIF-2α inhibitor',
                  mechanismSources: ['NCIT:C192674', 'NCIT:C52200', 'NCIT:C159549', 'NCIT:C2654'],
                  brief:
                    'Evaluates safety and tolerability of casdatifan (AB521) alone in advanced solid tumors, and alone or with cabozantinib, zimberelimab, or zimberelimab plus ipilimumab in clear cell RCC.',
                  sites: [ucsd('811338', 'McKay', OPEN_HILLCREST)],
                },
                {
                  // placement: histology not specified ("renal cell carcinoma").
                  title:
                    'C6461008: PF-08634404 Monotherapy and in Combination with Other Anticancer Agents in Locally Advanced or Metastatic Renal Cell Carcinoma',
                  shorthand: 'C6461008',
                  protocol: 'C6461008',
                  nct: 'NCT07227415',
                  phase: 'Phase 1b/2',
                  intervention: 'PF-08634404 ± ipilimumab, axitinib, or casdatifan',
                  mechanism: 'PD-1 × VEGF bispecific antibody',
                  mechanismSources: ['NCIT:C223904', 'NCIT:C2654', 'NCIT:C38718', 'NCIT:C192674'],
                  brief:
                    'Evaluates the safety and efficacy of PF-08634404 alone or with ipilimumab, axitinib, or casdatifan in previously untreated locally advanced or metastatic renal cell carcinoma.',
                  sites: [ucsd('813550', 'McKay', 'Open cohorts: Arms A and B1'), coh('Pal')],
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
                  // NCT matched on ClinicalTrials.gov (CT.gov study ID HCRN-GU22-595).
                  nct: 'NCT06863311',
                  intervention: 'Zanzalintinib (XL092) + nivolumab vs zanzalintinib',
                  mechanism: 'MET/VEGFR2/AXL/MER tyrosine kinase inhibitor + PD-1 inhibitor',
                  mechanismSources: ['NCIT:C161598', 'NCIT:C68814'],
                  brief:
                    'Compares zanzalintinib (XL092) alone versus with nivolumab in advanced clear cell RCC that progressed on or after adjuvant anti-PD-1/PD-L1 therapy.',
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
                  // NCT matched on ClinicalTrials.gov (CT.gov study ID S2419).
                  nct: 'NCT07383441',
                  intervention: 'MO-03 (CBM 588) + standard IO regimen vs placebo + IO',
                  mechanism: 'Gut microbiome-modulating probiotic (C. butyricum CBM 588)',
                  mechanismSources: ['NCIT:C227093'],
                  brief:
                    'Tests whether adding live biotherapeutic MO-03 to standard first-line immunotherapy combinations improves progression-free survival versus placebo in advanced clear cell RCC, as the gut microbiome may affect immunotherapy.',
                  sites: [usc('S2419', 'Sadeghi')],
                },
                {
                  // placement: City of Hope lists this as Metastatic without a
                  // line; the study's official title specifies first-line
                  // treatment of metastatic RCC.
                  title: 'Immunotherapy (Nivolumab and Ipilimumab) With and Without EXL01',
                  shorthand: 'EXL01',
                  nct: 'NCT07128680',
                  phase: 'Phase 1',
                  intervention: 'EXL01 + nivolumab + ipilimumab vs nivolumab + ipilimumab',
                  mechanism: 'Gut microbiome modulator (F. prausnitzii)',
                  mechanismSources: ['NCIT:C220619'],
                  brief:
                    'Tests adding EXL01, a Faecalibacterium prausnitzii live biotherapeutic intended to enhance checkpoint-inhibitor response via gut bacteria, to first-line nivolumab plus ipilimumab in metastatic renal cell carcinoma.',
                  sites: [coh('Pal')],
                },
              ],
            },
            {
              label: '2nd & Beyond',
              kind: 'LINE_OF_THERAPY',
              tag: 'Line',
              trials: [
                {
                  // The UCSD list called HC-7366 an "eIF4A inhibitor"; ClinicalTrials.gov and the
                  // NCI Thesaurus (C222803) both describe a GCN2 kinase activator, so that label is dropped.
                  title: 'HC366-RCC2311: HC-7366 + belzutifan',
                  shorthand: 'HC366-RCC2311',
                  protocol: 'HC366-RCC2311',
                  nct: 'NCT06234605',
                  phase: 'Phase 1b',
                  setting: 'Progressed after standard first-line treatment',
                  summary:
                    'A phase Ib study evaluating the safety, optimal dosing, and preliminary efficacy of HC-7366 in combination with belzutifan in patients with locally advanced or metastatic clear-cell renal cell carcinoma.',
                  intervention: 'HC-7366 + belzutifan',
                  mechanism: 'GCN2 kinase activator + HIF-2α inhibitor',
                  mechanismSources: ['NCIT:C222803', 'NCIT:C135627'],
                  brief:
                    'Evaluates the safety, maximum tolerated dose, and efficacy of HC-7366 alone and with belzutifan in locally advanced or metastatic, predominantly clear cell renal cell carcinoma.',
                  sites: [cedars('Posadas'), ucsd('809847', 'McKay', 'Combo cohort available only')],
                },
                {
                  title:
                    'ARC-PEAK: Casdatifan and Cabozantinib Versus Placebo and Cabozantinib in Advanced Clear Cell Renal Cell Carcinoma',
                  shorthand: 'ARC-PEAK',
                  nct: 'NCT07011719',
                  phase: 'Phase 3',
                  intervention: 'Casdatifan + cabozantinib vs placebo + cabozantinib',
                  mechanism: 'HIF-2α inhibitor',
                  mechanismSources: ['NCIT:C192674'],
                  brief:
                    'Compares casdatifan plus cabozantinib versus placebo plus cabozantinib for progression-free survival in advanced clear cell renal cell carcinoma progressing on or after prior anti-PD-1/PD-L1 therapy.',
                  sites: [ucsd('812233', 'McKay'), coh('Pal')],
                },
                {
                  title:
                    'NEO-811-101: First-in-Human Dose Escalation and Expansion Study of NEO-811 in Locally Advanced or Metastatic Non-Resectable Clear Cell RCC',
                  shorthand: 'NEO-811-101',
                  nct: 'NCT07300241',
                  phase: 'Phase 1/2',
                  intervention: 'NEO-811',
                  mechanism: 'ARNT molecular glue degrader',
                  mechanismSources: ['CTGOV:NCT07300241'],
                  brief:
                    'Tests NEO-811, an ARNT molecular glue degrader, as monotherapy in a first-in-human dose escalation and expansion study in locally advanced or metastatic non-resectable clear cell RCC.',
                  sites: [ucsd('813588', 'McKay'), coh('Pal')],
                },
                {
                  // placement: an all-solid-tumor study; UCSD lists it under RCC
                  // "Metastatic, prior treatment". Histology not specified.
                  title:
                    'INCA036873-101: Open-Label, Multicenter Study of INCA036873 in Advanced Solid Tumors and Hematological Malignancies',
                  shorthand: 'INCA036873-101',
                  phase: 'Phase 1',
                  // NCT matched on ClinicalTrials.gov (CT.gov study ID INCA036873-101).
                  nct: 'NCT07195916',
                  intervention: 'INCA036873',
                  mechanism: 'CD70 × CD3 bispecific T-cell engager',
                  mechanismSources: ['NCIT:C226744'],
                  brief:
                    'Tests the safety and tolerability of intravenous INCA036873, with dose escalation, expansion and pharmacodynamic cohorts, in advanced solid tumors and hematological malignancies.',
                  sites: [ucsd('813929', 'Chen')],
                },
                {
                  // placement: City of Hope lists this as Metastatic without a
                  // line; it is for relapsed or refractory disease.
                  title: 'XmAb819 in Relapsed/Refractory Clear Cell RCC',
                  shorthand: 'XmAb819',
                  nct: 'NCT05433142',
                  phase: 'Phase 1',
                  intervention: 'XmAb819',
                  mechanism: 'ENPP3 × CD3 bispecific antibody',
                  mechanismSources: ['NCIT:C188359'],
                  brief:
                    'Evaluates the safety, tolerability, and recommended dose of XmAb819, given intravenously or subcutaneously, in relapsed or refractory clear cell renal cell carcinoma.',
                  sites: [coh('Pal')],
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
              // NCT pending verification: likely NCT04981509, but no protocol-ID or acronym anchor confirms it.
              intervention: 'Bevacizumab + erlotinib + atezolizumab',
              mechanism: 'Anti-VEGF antibody + EGFR tyrosine kinase inhibitor + PD-L1 inhibitor',
              mechanismSources: ['NCIT:C2039', 'NCIT:C65530', 'NCIT:C106250'],
              brief:
                'Tests bevacizumab, erlotinib and atezolizumab together in advanced HLRCC-associated or sporadic papillary renal cell cancer.',
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
          // NCT matched on ClinicalTrials.gov (CT.gov study ID A092204).
          nct: 'NCT06900595',
          intervention: 'Cemiplimab + cabozantinib vs cabozantinib',
          mechanism: 'PD-1 inhibitor + multitargeted tyrosine kinase inhibitor',
          mechanismSources: ['NCIT:C121540', 'NCIT:C52200'],
          brief:
            'Compares cabozantinib plus cemiplimab versus cabozantinib alone in adolescents and adults with advanced adrenocortical cancer to determine whether adding cemiplimab improves progression-free survival.',
          sites: [ucsd('813740', 'Chen', COORDINATOR_TBD)],
        },
        {
          title:
            'IRONMAN: An International Registry to Improve Outcomes in Men with Advanced Prostate Cancer',
          shorthand: 'IRONMAN',
          phase: 'Registry',
          // NCT matched on ClinicalTrials.gov (acronym IRONMAN, same drug, disease and phase).
          nct: 'NCT03151629',
          intervention: 'Prospective registry with PROMs and blood biobanking',
          brief:
            'Collects treatment, outcome, patient-reported and blood biomarker data from men with advanced prostate cancer (mHSPC, M0/M1 CRPC) to understand care variation and optimal treatment sequences.',
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
          // NCT matched on ClinicalTrials.gov (USC study 4P-22-2 = CT.gov study ID; USC-sponsored, PI Goldkorn).
          nct: 'NCT06067295',
          intervention: 'Blood and urine biorepository cohort',
          brief:
            'Collects blood, urine, surveys and medical-record data from men with advanced prostate cancer to build an annotated biorepository aimed at learning ways to improve outcomes.',
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
          // NCT pending verification: no ClinicalTrials.gov record found.
          intervention: 'Clinical data and biospecimen collection',
          brief:
            'Collects clinical data and biospecimens from patients with genitourinary malignancies to assess predictive and prognostic biomarkers.',
          sites: [ucsd('190443', 'McKay', OPEN_HILLCREST)],
        },
        {
          title: 'NIH 000048: A Multi-Center Natural History Study of Precision-Based Genomics in Prostate Cancer',
          shorthand: 'NIH 000048',
          phase: 'Natural history',
          summary:
            'Must have: PIK3 and/or AKT, PALB2, BRIP1, RAD50, RAD51, RAD54, RB1, SPOP, Wnt/B-catenin pathway, and MMR genes (MLH1, MSH2, MSH6, PMS2, EPCAM) and/or TMB-high, or be deemed an exceptional responder. Any platform for genomics testing is acceptable (research or CLIA-certified).',
          // NCT pending verification: likely NCT04706663, but no protocol-ID or acronym anchor confirms it.
          intervention: 'Genomics-based natural history cohort',
          brief:
            'Studies the natural history of prostate cancer in a multi-center cohort characterized by precision-based genomics.',
          sites: [ucsd('804730', 'McKay')],
        },
        {
          title:
            'AGCT-1531: Active Surveillance for Low Risk and Randomized Carboplatin vs Cisplatin for Standard Risk Pediatric and Adult Germ Cell Tumors',
          shorthand: 'AGCT-1531',
          protocol: 'AGCT-1531',
          phase: 'Phase 3',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID AGCT1531).
          nct: 'NCT03067181',
          intervention: 'Surveillance (low risk); carboplatin vs cisplatin',
          mechanism: 'Platinum agent',
          mechanismSources: ['NCIT:C1282'],
          brief:
            'Tests surveillance after complete resection for low-risk germ cell tumors and compares carboplatin- versus cisplatin-based chemotherapy for standard-risk disease in patients younger than 25.',
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
          // NCT matched on ClinicalTrials.gov (acronym P3BEP, accelerated vs standard BEP in germ cell tumours).
          nct: 'NCT02582697',
          intervention: 'Accelerated vs standard BEP chemotherapy',
          mechanism: 'Antitumor antibiotic + topoisomerase II inhibitor + platinum agent',
          mechanismSources: ['NCIT:C312', 'NCIT:C491', 'NCIT:C376'],
          brief:
            'Compares accelerated (2-weekly) versus standard (3-weekly) BEP as first-line chemotherapy for intermediate- and poor-risk metastatic germ cell tumours, where new strategies are needed to improve cure.',
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
          // NCT matched on ClinicalTrials.gov (USC study 4T-22-2 = CT.gov study ID; USC-sponsored, PI Daneshmand).
          nct: 'NCT06060873',
          intervention: 'Serum miRNA-371 test to guide RPLND vs surveillance',
          brief:
            'Evaluates how accurately serum miRNA-371 predicts active germ cell malignancy before surgery in testicular germ cell tumors that are clinical stage I or have retroperitoneal nodes under 3 cm.',
          sites: [usc('4T-22-2', 'Daneshmand')],
        },
        {
          title:
            'MOMA-313-001: MOMA-313 as Monotherapy or in Combination with a PARP Inhibitor in Advanced or Metastatic Solid Tumors',
          shorthand: 'MOMA-313-001',
          phase: 'Phase 1',
          // NCT matched on ClinicalTrials.gov (CT.gov study ID MOMA-313-001).
          nct: 'NCT06545942',
          intervention: 'MOMA-313 ± olaparib',
          mechanism: 'DNA polymerase theta inhibitor + PARP inhibitor',
          mechanismSources: ['NCIT:C211936', 'NCIT:C71721'],
          brief:
            'Tests the safety, tolerability and optimal dose of oral MOMA-313 alone or with olaparib in advanced homologous recombination-deficient solid tumors, including prostate cancer.',
          sites: [ucsd('810837', 'McKay')],
        },
        {
          title:
            'PRISM (IIT Incyte): Retifanlimab and Ruxolitinib in Solid Malignancies Progressing on Prior Checkpoint Inhibition',
          shorthand: 'PRISM',
          phase: 'Phase 1b',
          // NCT matched on ClinicalTrials.gov (acronym PRISM, same drug, disease and phase).
          nct: 'NCT07219576',
          intervention: 'Ruxolitinib + retifanlimab',
          mechanism: 'JAK1/2 inhibitor + PD-1 inhibitor',
          mechanismSources: ['NCIT:C77888', 'NCIT:C142168'],
          brief:
            'Tests the safe dose of ruxolitinib with retifanlimab in metastatic renal cell or non-small cell lung cancer progressing on checkpoint inhibitors, an unmet treatment need.',
          sites: [ucsd('812209', 'McKay')],
        },
        {
          title: 'ADC MATCH',
          shorthand: 'ADC MATCH',
          nct: 'NCT06311214',
          phase: 'Phase 2',
          setting: 'Precision oncology / basket trial',
          intervention: 'Biomarker-matched ADC: sacituzumab govitecan, EV, or T-DXd',
          mechanism: 'Trop-2-directed ADC + Nectin-4-directed ADC + HER2-directed ADC',
          mechanismSources: ['NCIT:C102783', 'NCIT:C114500', 'NCIT:C128799'],
          brief:
            'Tests whether biomarker-directed treatment with sacituzumab govitecan, enfortumab vedotin, or trastuzumab deruxtecan, matched to high Trop-2, nectin-4, or HER2 expression, works in advanced solid tumors.',
          sites: [coh('Chehrazi-Raffle')],
        },
      ],
    },
  ],
};

/** Every tree, in display order. */
export const CURATED_TREES: CuratedNode[] = [PROSTATE, BLADDER, KIDNEY, OTHER_GU];
