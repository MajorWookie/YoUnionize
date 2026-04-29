export interface ClaudeClientConfig {
  apiKey: string
  model?: string
  /** Voyage AI API key for embeddings. Falls back to VOYAGE_API_KEY env var. */
  voyageApiKey?: string
  /** Voyage AI embedding model. Defaults to VOYAGE_EMBEDDING_MODEL env var or 'voyage-4-lite'. */
  voyageModel?: string
}

export interface KeyNumber {
  label: string
  value: string
  context: string
}

export interface FilingSummaryResult {
  executive_summary: string
  key_numbers: Array<KeyNumber>
  /** Short-form: 2-3 sentences explaining what happened and why it matters */
  plain_language_explanation: string
  red_flags: Array<string>
  opportunities: Array<string>
  /** Short-form: 2-3 sentences on what this means for employees */
  employee_relevance: string
}

export interface CompensationComparison {
  label: string
  insight: string
}

export interface CompensationAnalysisResult {
  fairness_score: number
  explanation: string
  comparisons: Array<CompensationComparison>
  recommendations: Array<string>
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface AiResponse<T> {
  data: T
  usage: TokenUsage
  cached: boolean
}

export interface CompanySummaryResult {
  headline: string
  company_health: string
  key_numbers: Array<KeyNumber>
  red_flags: Array<string>
  opportunities: Array<string>
}

/**
 * Outlook portion of the employee-impact rollup. Produced by
 * `generateEmployeeImpact` from pre-summarised section context. Job security,
 * compensation, growth — the "is the company a good place to work" lens.
 */
export interface EmployeeOutlookResult {
  overall_outlook: string
  job_security: string
  compensation_signals: string
  growth_opportunities: string
  watch_items: Array<string>
}

/**
 * Workforce-geography + H-1B/visa portion of the employee-impact rollup.
 * Produced by `generateWorkforceSignals` from raw business_overview +
 * risk_factors text (pre-summarised text loses the specific quotes/numbers
 * this prompt needs).
 */
export interface WorkforceSignalsResult {
  workforce_geography: string
  h1b_and_visa_dependency: string
  watch_items: Array<string>
}

/**
 * Merged shape stored on `filing_summaries.ai_summary.employee_impact` for
 * frontend backwards compatibility. The summarisation pipeline runs
 * `generateEmployeeImpact` and `generateWorkforceSignals` separately, then
 * merges the two outputs into this single object so consumers don't have to
 * change.
 */
export interface EmployeeImpactResult {
  overall_outlook: string
  job_security: string
  compensation_signals: string
  growth_opportunities: string
  workforce_geography: string
  h1b_and_visa_dependency: string
  watch_items: Array<string>
}

export const CURRENT_SUMMARY_VERSION = 3
