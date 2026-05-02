import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface CybersecuritySummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.`

export function cybersecuritySummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function cybersecuritySummaryUserPrompt(params: CybersecuritySummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Cybersecurity',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
