import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface NarrativeSummaryParams {
  section: string
  companyName: string
  filingType: string
}

/**
 * Catch-all summarisation prompt for SEC sections without a dedicated
 * dispatch entry. Used by `DEFAULT_DISPATCH` in
 * `packages/sec-api/src/section-prompts.ts` whenever a section_code
 * isn't explicitly mapped — typical for new sub-items, unusual filer
 * conventions, or low-traffic items not worth their own template.
 */

const GUIDANCE = `Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.`

export function narrativeSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function narrativeSummaryUserPrompt(params: NarrativeSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Filing',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
