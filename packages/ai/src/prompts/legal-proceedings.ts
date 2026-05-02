import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface LegalProceedingsSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Focus on lawsuits and legal issues that could affect the company:
- Are there employee-related lawsuits (discrimination, wage theft, safety)?
- Are there government investigations?
- How much money is at risk from pending cases?
- Could any of these result in fines, shutdowns, or leadership changes?`

export function legalProceedingsSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function legalProceedingsSummaryUserPrompt(params: LegalProceedingsSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Legal Proceedings',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
