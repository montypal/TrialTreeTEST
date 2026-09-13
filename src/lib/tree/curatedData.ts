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
//
// A trial open at both centers is ONE trial with two sites (7 such overlaps,
// confirmed against ClinicalTrials.gov protocol IDs where not identical).
//
// Placement:
//   • Kidney follows the clinician's whiteboard tree exactly
//     (Stage → Histology → Line; only Clear cell carries therapy lines).
//   • Prostate and Bladder use each list's own section headers as one level,
//     pending the clinician's whiteboard trees for those cancers.
//   • A few UCSD rows sit under a section that doesn't match the trial's own
//     title; those were placed by the title and are marked "placement:" below.
//
// PIs are surnames only, exactly as the lists give them. Coordinator emails
// and phone numbers from the UCSD list are deliberately NOT stored — this
// site is public and has no login.
// ---------------------------------------------------------------------------

export type CenterSlug = 'cedars-sinai' | 'ucsd';

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

const OPEN_HILLCREST = 'Open at Hillcrest';
const COORDINATOR_TBD = 'Coordinator TBD — contact the project manager';

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
          sites: [cedars('Posadas'), ucsd('181866', 'Bagrodia')],
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
          sites: [cedars('Posadas')],
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
          sites: [ucsd('813463', 'McKay')],
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
          sites: [cedars('Ballas')],
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
                  sites: [cedars('Posadas'), ucsd('812777', 'McKay')],
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
                  sites: [cedars('Posadas')],
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
                  sites: [cedars('Kim')],
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
