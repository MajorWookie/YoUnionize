import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface RelatedTransactionsSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.`

export function relatedTransactionsSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function relatedTransactionsSummaryUserPrompt(params: RelatedTransactionsSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Related Party Transactions',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
