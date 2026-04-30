export interface Event8kSummaryParams {
  /**
   * The 8-K event text. The caller is expected to prefix this with the
   * section's friendly name (e.g. `"Item 5.02 — Departure of Directors:\n…"`)
   * so that Claude has both the human-readable item label and the body in
   * a single payload. The friendly-name lookup lives in
   * `@younionize/sec-api` (`getSectionFriendlyName`); keeping the prefix
   * computation in the pipeline avoids a cross-package import.
   */
  section: string
  companyName: string
  filingType: string
}

export function event8kSummarySystemPrompt(): string {
  return `You are a financial translator who converts dense SEC filing sections into plain-language summaries for everyday workers.

Section type: event_summary

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

export function event8kSummaryUserPrompt(params: Event8kSummaryParams): string {
  return `Summarize this "event_summary" section from ${params.companyName}'s ${params.filingType} filing.

Section content:
${params.section}`
}
