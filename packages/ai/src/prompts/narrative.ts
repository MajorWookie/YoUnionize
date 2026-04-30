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
 *
 * The label "narrative" is hardcoded here rather than passed as a
 * parameter to preserve byte-identity with the pre-cleanup output of
 * the old `summarizeSection({ sectionType: 'narrative', ... })` call.
 * Future enrichment (e.g. interpolating the actual section_code label)
 * is a deliberate prompt-content change and belongs in Phase 3 of the
 * per-section prompt-module refactor.
 */
export function narrativeSummarySystemPrompt(): string {
  return `You are a financial translator who converts dense SEC filing sections into plain-language summaries for everyday workers.

Section type: narrative

Specific guidance for this section:
Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.

Rules:
- Write at an 6th-grade reading level
- No jargon without immediate plain-language definitions
- Use bullet points for lists
- Lead with the most important takeaway
- Keep the total summary under 150 words (2-3 short paragraphs maximum)
- Be honest — employees deserve to know the truth
- Be concise: every sentence must add new information

Respond with a plain text summary. No JSON, no markdown headers.`
}

export function narrativeSummaryUserPrompt(params: NarrativeSummaryParams): string {
  return `Summarize this "narrative" section from ${params.companyName}'s ${params.filingType} filing.

Section content:
${params.section}`
}
