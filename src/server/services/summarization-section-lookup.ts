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
 *
 * Codes are inlined as string literals (rather than imported from
 * @union/sec-api enums) to keep this module pure and Vitest-resolvable.
 * The values must stay in sync with `packages/sec-api/src/sec-api.constants.ts`;
 * the round-trip tests in `sections.test.ts` lock those constants in place.
 */
export const PIPELINE_SECTION_TO_CODE: Record<string, Record<string, string>> = {
  '10-K': {
    business_overview: '1',          // TenKSection.BUSINESS_OVERVIEW
    risk_factors: '1A',              // TenKSection.RISK_FACTORS
    mda: '7',                        // TenKSection.MD_AND_A
    legal_proceedings: '3',          // TenKSection.LEGAL_PROCEEDINGS
    executive_compensation: '11',    // TenKSection.EXECUTIVE_COMPENSATION
    footnotes: '8',                  // TenKSection.FINANCIAL_STATEMENTS
  },
  '10-Q': {
    mda: 'part1item2',               // TenQSection.MD_AND_A
    risk_factors: 'part2item1a',     // TenQSection.RISK_FACTORS
    legal_proceedings: 'part2item1', // TenQSection.LEGAL_PROCEEDINGS
    footnotes: 'part1item1',         // TenQSection.FINANCIAL_STATEMENTS
  },
  'DEF 14A': {
    executive_compensation: 'part1item7', // Def14aSection.EXECUTIVE_COMPENSATION
    proxy: 'part1item1',                  // Def14aSection.PROXY
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
