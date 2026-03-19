export interface ClaudeClientConfig {
  apiKey: string
  model?: string
  /** OpenAI API key for embeddings. Falls back to OPENAI_API_KEY env var. */
  openaiApiKey?: string
  /** Embedding provider: 'ollama' for local embeddings, 'openai' for OpenAI API. Defaults to 'ollama' if OLLAMA_BASE_URL is set, otherwise 'openai'. */
  embeddingProvider?: 'openai' | 'ollama'
  /** Ollama base URL. Defaults to OLLAMA_BASE_URL env var or http://localhost:11434. */
  ollamaBaseUrl?: string
  /** Ollama embedding model name. Defaults to OLLAMA_EMBEDDING_MODEL env var or 'nomic-embed-text'. */
  ollamaEmbeddingModel?: string
}

export interface KeyNumber {
  label: string
  value: string
  context: string
}

export interface FilingSummaryResult {
  executive_summary: string
  key_numbers: Array<KeyNumber>
  plain_language_explanation: string
  red_flags: Array<string>
  opportunities: Array<string>
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
