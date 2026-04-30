export interface BusinessOverviewSummaryParams {
  section: string
  companyName: string
  filingType: string
}

export function businessOverviewSummarySystemPrompt(): string {
  return `You are a financial translator who converts dense SEC filing sections into plain-language summaries for everyday workers.

Section type: businessOverview

Specific guidance for this section:
Explain what this company actually does in simple terms:
- What products/services do they sell?
- Who are their customers?
- How do they make money?
- How many people work there and where?
- What makes them different from competitors?

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

export function businessOverviewSummaryUserPrompt(params: BusinessOverviewSummaryParams): string {
  return `Summarize this "businessOverview" section from ${params.companyName}'s ${params.filingType} filing.

Section content:
${params.section}`
}
