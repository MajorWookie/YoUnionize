import { Def14aSection, TenKSection, TenQSection } from '@younionize/sec-api'

/**
 * In-memory section text loaded for a single filing. Built once at the top
 * of `summarizeSingleFiling` to avoid repeated DB hits as the section
 * dispatcher fans out across summarizers.
 */
export type SectionMap = Map<string, string>

/**
 * Maps pipeline section names (snake_case, used in FILING_SECTIONS and
 * ai_summary keys) to the underlying SEC section codes stored in
 * filing_sections.
 *
 * The same pipeline name resolves to different codes per filing type
 * because SEC item numbering is form-specific (e.g. MD&A is item '7' on
 * a 10-K but 'part1item2' on a 10-Q).
 */
export const PIPELINE_SECTION_TO_CODE: Record<string, Record<string, string>> = {
  '10-K': {
    business_overview: TenKSection.BUSINESS_OVERVIEW,
    risk_factors: TenKSection.RISK_FACTORS,
    mda: TenKSection.MD_AND_A,
    legal_proceedings: TenKSection.LEGAL_PROCEEDINGS,
    executive_compensation: TenKSection.EXECUTIVE_COMPENSATION,
    footnotes: TenKSection.FINANCIAL_STATEMENTS,
  },
  '10-Q': {
    mda: TenQSection.MD_AND_A,
    risk_factors: TenQSection.RISK_FACTORS,
    legal_proceedings: TenQSection.LEGAL_PROCEEDINGS,
    footnotes: TenQSection.FINANCIAL_STATEMENTS,
  },
  'DEF 14A': {
    executive_compensation: Def14aSection.EXECUTIVE_COMPENSATION,
    proxy: Def14aSection.PROXY,
  },
}

/**
 * Look up text for a pipeline section name within a pre-loaded SectionMap.
 * Returns null when the pipeline section has no code mapping for the given
 * filing type, or when the code isn't present in the map.
 */
export function getPipelineSectionText(
  sections: SectionMap,
  pipelineSection: string,
  filingType: string,
): string | null {
  const code = PIPELINE_SECTION_TO_CODE[filingType]?.[pipelineSection]
  if (!code) return null
  return sections.get(code) ?? null
}
