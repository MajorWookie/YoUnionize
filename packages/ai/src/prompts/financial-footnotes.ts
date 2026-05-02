import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface FinancialFootnotesSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Break down the financial statements into everyday terms:
- Revenue: how much money came in
- Expenses: how much went out (and where)
- Profit/Loss: did they make or lose money?
- Debt: how much do they owe?
- Cash: how much do they have on hand?
Compare to prior year — are things getting better or worse?`

export function financialFootnotesSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function financialFootnotesSummaryUserPrompt(params: FinancialFootnotesSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Financial Statements',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
