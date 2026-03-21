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

export const CURRENT_SUMMARY_VERSION = 1
