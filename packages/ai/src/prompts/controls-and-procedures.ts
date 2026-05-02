import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface ControlsAndProceduresSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.`

export function controlsAndProceduresSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({ guidance: GUIDANCE })
}

export function controlsAndProceduresSummaryUserPrompt(params: ControlsAndProceduresSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Controls and Procedures',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
