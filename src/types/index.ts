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
