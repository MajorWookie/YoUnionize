export interface SectionSummaryParams {
  section: string
  sectionType: string
  companyName: string
  filingType: string
}

const SECTION_GUIDANCE: Record<string, string> = {
  riskFactors: `Focus on risks that could affect employees directly:
- Job security risks (competition, market decline, restructuring plans)
- Benefits and compensation risks
- Regulatory risks that could force layoffs or office closures
- Financial risks that suggest the company might struggle to pay workers
Skip boilerplate legal language. Highlight NEW risks added since last filing if possible.`,

  businessOverview: `Explain what this company actually does in simple terms:
- What products/services do they sell?
- Who are their customers?
- How do they make money?
- How many people work there and where?
- What makes them different from competitors?`,

  legalProceedings: `Focus on lawsuits and legal issues that could affect the company:
- Are there employee-related lawsuits (discrimination, wage theft, safety)?
- Are there government investigations?
- How much money is at risk from pending cases?
- Could any of these result in fines, shutdowns, or leadership changes?`,

  financialStatements: `Break down the financial statements into everyday terms:
- Revenue: how much money came in
- Expenses: how much went out (and where)
- Profit/Loss: did they make or lose money?
- Debt: how much do they owe?
- Cash: how much do they have on hand?
Compare to prior year — are things getting better or worse?`,

  executiveCompensation: `Explain how executives are paid in relation to regular employees:
- Total CEO pay vs. median worker pay
- What percentage is salary vs. stock/bonuses?
- Did executive pay go up while the company struggled?
- How does their pay compare to the industry?
This is personal for employees — be direct about the gap.`,
}

export function sectionSummarySystemPrompt(sectionType: string): string {
  const guidance = SECTION_GUIDANCE[sectionType] ?? `Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.`

  return `You are a financial translator who converts dense SEC filing sections into plain-language summaries for everyday workers.

Section type: ${sectionType}

Specific guidance for this section:
${guidance}

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

export function sectionSummaryUserPrompt(params: SectionSummaryParams): string {
  return `Summarize this "${params.sectionType}" section from ${params.companyName}'s ${params.filingType} filing.

Section content:
${params.section}`
}
