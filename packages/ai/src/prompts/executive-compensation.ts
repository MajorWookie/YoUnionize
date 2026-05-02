import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface ExecutiveCompensationSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Explain how executives are paid in relation to regular employees:
- Total CEO pay vs. median worker pay
- What percentage is salary vs. stock/bonuses?
- Did executive pay go up while the company struggled?
- How does their pay compare to the industry?
This is personal for employees — be direct about the gap.`

export function executiveCompensationSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function executiveCompensationSummaryUserPrompt(params: ExecutiveCompensationSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Executive Compensation',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
