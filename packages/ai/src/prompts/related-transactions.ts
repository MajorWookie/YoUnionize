export interface RelatedTransactionsSummaryParams {
  section: string
  companyName: string
  filingType: string
}

export function relatedTransactionsSummarySystemPrompt(): string {
  return `You are a financial translator who converts dense SEC filing sections into plain-language summaries for everyday workers.

Section type: relatedTransactions

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

export function relatedTransactionsSummaryUserPrompt(params: RelatedTransactionsSummaryParams): string {
  return `Summarize this "relatedTransactions" section from ${params.companyName}'s ${params.filingType} filing.

Section content:
${params.section}`
}
