import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface RiskFactorsSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Focus on risks that could affect employees directly:
- Job security risks (competition, market decline, restructuring plans)
- Benefits and compensation risks
- Regulatory risks that could force layoffs or office closures
- Financial risks that suggest the company might struggle to pay workers
Skip boilerplate legal language. Highlight NEW risks added since last filing if possible.`

export function riskFactorsSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function riskFactorsSummaryUserPrompt(params: RiskFactorsSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Risk Factors',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
