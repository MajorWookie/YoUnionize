import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface ProxySummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.`

export function proxySummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function proxySummaryUserPrompt(params: ProxySummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Proxy Statement',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
