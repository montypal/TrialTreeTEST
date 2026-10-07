// Serializable DTOs sent from /api/tree to the client and fed into buildTree().

export type RecruitmentStatus = 'RECRUITING' | 'WAITLISTED' | 'CLOSED' | 'SUSPENDED';
export type NodeKind = 'DISEASE_TYPE' | 'DISEASE_STATE' | 'LINE_OF_THERAPY' | 'BIOMARKER';

export interface DecisionNodeDTO {
  id: string;
  label: string;
  kind: NodeKind;
  parentId: string | null;
  sortOrder: number;
  /** Optional axis label shown on the node (e.g. "Stage", "Histology", "Line"). */
  tag?: string | null;
}

export interface TrialLocationDTO {
  locationSlug: string;
  locationName: string;
  status: RecruitmentStatus;
  piName: string | null;
  slotsOpen: number | null;
}

export interface CohortDTO {
  id: string;
  label: string;
  status: RecruitmentStatus;
}

export interface TrialDTO {
  id: string;
  nctId: string | null;
  protocolNumber: string | null;
  shorthand: string | null;
  title: string;
  phase: string | null;
  principalInvestigator: string | null;
  eligibilityCriteria: string | null;
  decisionNodeId: string;
  locations: TrialLocationDTO[];
  cohorts: CohortDTO[];
  /** Where the record came from: CURATED (a center's own list), CTGOV (the
      ClinicalTrials.gov importer) or MANUAL. Optional so older producers of
      this shape keep compiling; absent means "not recorded". */
  source?: string | null;
  /** A plain-language summary, sent ONLY once a human has approved it — the
      API withholds unapproved text, so its presence here means signed off. */
  summary?: string | null;
  summarySource?: string | null;
  summaryApproved?: boolean;
  summaryGeneratedAt?: string | null;
  /** What is being tested, as a physician would say it ("Belzutifan + pembrolizumab"). */
  intervention?: string | null;
  /** Mechanism of the investigational agent(s), as the NCI Thesaurus or the
      ClinicalTrials.gov record states it. Null when no source states one. */
  mechanism?: string | null;
  /** Where each mechanism came from: "NCIT:C135627" or "CTGOV:NCT01234567". */
  mechanismSources?: string[];
  /** CURATED: the NCT came from a center's list or the curated file.
      AUTO_MATCHED: the enrichment job matched it on a ClinicalTrials.gov
      identifier. Null when there is no NCT yet. */
  nctSource?: string | null;
  /** For AUTO_MATCHED only: the identifier that justified the match. */
  nctMatchNote?: string | null;
  /** Registry facts read from ClinicalTrials.gov, never generated. Null until
      the enrichment job has fetched this trial's record. */
  ctgov?: CtgovMetaDTO | null;
}

export interface CtgovOfficialDTO {
  name: string;
  /** As registered: "Principal Investigator", "Study Chair", "Study Director". */
  role: string | null;
  affiliation: string | null;
}

/** What ClinicalTrials.gov says about a trial, and when we last asked. */
export interface CtgovMetaDTO {
  /** Registry status as registered, e.g. "RECRUITING", "ACTIVE_NOT_RECRUITING". */
  overallStatus: string | null;
  sponsor: string | null;
  officials: CtgovOfficialDTO[];
  /** ISO timestamp of the fetch. */
  checkedAt: string;
}

export interface TreeData {
  decisionNodes: DecisionNodeDTO[];
  trials: TrialDTO[];
  /** Distinct PI names, for the admin sidebar filter. */
  principalInvestigators: string[];
}

export interface TreeFilter {
  /** Restrict to a single location slug (kiosk always sets this). */
  locationSlug?: string | null;
  /** Restrict to a single PI (admin sidebar). */
  pi?: string | null;
  /** Free-text search across title / NCT / drug / PI / protocol. */
  search?: string | null;
  /** Restrict to one disease type by its root node label ("Prostate Cancer"). */
  diseaseLabel?: string | null;
}
