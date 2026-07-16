// Classify a trial by treatment approach — how a clinician actually searches
// for a trial ("is there a checkpoint-inhibitor / PARP / ADC option?").
// First match wins, so the more distinctive agent leads a combination.

export const CLASS_ORDER = [
  'Antibody-drug conjugate',
  'PARP inhibitor',
  'FGFR inhibitor',
  'PSMA / radioligand',
  'Gene / cell therapy',
  'Intravesical / BCG',
  'Immunotherapy (IO)',
  'Hormonal (ARPI)',
  'TKI / anti-angiogenic',
  'Chemotherapy',
  'Other / investigational',
];

export function treatmentClass(t: { title: string; shorthand?: string | null }): string {
  const s = `${t.title} ${t.shorthand ?? ''}`.toLowerCase();
  if (/enfortumab|sacituzumab|deruxtecan|disitamab|vedotin|govitecan|antibody.?drug conjugate|\badc\b/.test(s))
    return 'Antibody-drug conjugate';
  if (/olaparib|rucaparib|niraparib|talazoparib|\bparp\b/.test(s)) return 'PARP inhibitor';
  if (/erdafitinib|\bfgfr/.test(s)) return 'FGFR inhibitor';
  if (/lutetium|177\s?lu|lu-?177|\bpsma\b|radioligand|radiopharmaceutical|pluvicto|actinium/.test(s))
    return 'PSMA / radioligand';
  if (/gene therap|oncolytic|adenovir|\bcar-?t\b|nadofaragene|cretostimogene|cg\s?0070|eg-?70/.test(s))
    return 'Gene / cell therapy';
  if (/intravesical|\bbcg\b|tar-?20|tar-?21/.test(s)) return 'Intravesical / BCG';
  if (/pembrolizumab|nivolumab|ipilimumab|atezolizumab|durvalumab|avelumab|cemiplimab|tislelizumab|toripalimab|retifanlimab|pd-?l?1|pd-?1|ctla-?4|checkpoint|immunotherap/.test(s))
    return 'Immunotherapy (IO)';
  if (/enzalutamide|abiraterone|apalutamide|darolutamide|androgen receptor|\barpi\b|\badt\b/.test(s))
    return 'Hormonal (ARPI)';
  if (/cabozantinib|lenvatinib|axitinib|sunitinib|pazopanib|tivozanib|belzutifan|tyrosine kinase|\btki\b|vegf/.test(s))
    return 'TKI / anti-angiogenic';
  if (/cisplatin|carboplatin|gemcitabine|docetaxel|cabazitaxel|paclitaxel|chemotherap/.test(s))
    return 'Chemotherapy';
  return 'Other / investigational';
}
