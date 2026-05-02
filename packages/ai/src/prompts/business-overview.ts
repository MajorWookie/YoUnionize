import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface BusinessOverviewSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Explain what this company actually does in simple terms:
- What products/services do they sell?
- Who are their customers?
- How do they make money?
- How many people work there and where?
- What makes them different from competitors?`

export function businessOverviewSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function businessOverviewSummaryUserPrompt(params: BusinessOverviewSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Business Overview',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
