import Anthropic from '@anthropic-ai/sdk'
import {
  filingSummarySystemPrompt,
  filingSummaryUserPrompt,
} from './prompts/filing-summary'
import {
  sectionSummarySystemPrompt,
  sectionSummaryUserPrompt,
} from './prompts/section-summary'
import {
  compensationAnalysisSystemPrompt,
  compensationAnalysisUserPrompt,
} from './prompts/compensation-analysis'
import { ragAnswerSystemPrompt, ragAnswerUserPrompt } from './prompts/rag-answer'
import type {
  AiResponse,
  ClaudeClientConfig,
  CompensationAnalysisResult,
  FilingSummaryResult,
  TokenUsage,
} from './types'

const DEFAULT_MODEL = 'claude-haiku-4-5'
const DEFAULT_MAX_TOKENS = 4096

// OpenAI embedding config
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const OPENAI_EMBEDDING_DIMENSIONS = 1536

// Ollama embedding config
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text'
const OLLAMA_EMBEDDING_DIMENSIONS = 768

/**
 * Claude API client for SEC filing analysis, compensation insights, and RAG.
 *
 * Uses Claude for text generation. Embeddings are configurable:
 * - OpenAI (default): text-embedding-3-small, 1536 dimensions, requires OPENAI_API_KEY
 * - Ollama (local alternative): nomic-embed-text, 768 dimensions, activated by setting OLLAMA_BASE_URL
 */
export class ClaudeClient {
  private readonly anthropic: Anthropic
  private readonly model: string
  private readonly openaiApiKey: string | undefined
  private readonly embeddingProvider: 'openai' | 'ollama'
  private readonly ollamaBaseUrl: string
  private readonly ollamaEmbeddingModel: string

  constructor(config: ClaudeClientConfig) {
    this.anthropic = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model ?? DEFAULT_MODEL
    this.openaiApiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY
    this.ollamaBaseUrl =
      config.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL
    this.ollamaEmbeddingModel =
      config.ollamaEmbeddingModel ?? process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_OLLAMA_EMBEDDING_MODEL
    this.embeddingProvider =
      config.embeddingProvider ??
      (process.env.OLLAMA_BASE_URL ? 'ollama' : (this.openaiApiKey ? 'openai' : 'ollama'))
  }

  /** Returns the embedding dimensions for the active provider. */
  get embeddingDimensions(): number {
    return this.embeddingProvider === 'ollama'
      ? OLLAMA_EMBEDDING_DIMENSIONS
      : OPENAI_EMBEDDING_DIMENSIONS
  }

  // ─── Core Claude call ───────────────────────────────────────────────

  private async chat(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = DEFAULT_MAX_TOKENS,
  ): Promise<{ text: string; usage: TokenUsage }> {
    const maxRetries = 5
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const message = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        })

        const block = message.content[0]
        if (block.type !== 'text') {
          throw new Error(`Unexpected content block type: ${block.type}`)
        }

        const usage: TokenUsage = {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        }

        console.info(
          `[ClaudeClient] ${this.model} — ${usage.inputTokens} in / ${usage.outputTokens} out`,
        )

        return { text: block.text, usage }
      } catch (err) {
        lastError = err
        const status = (err as { status?: number }).status
        const isRateLimit = status === 429
        const isOverloaded = status === 529

        if ((isRateLimit || isOverloaded) && attempt < maxRetries) {
          // Parse retry-after header if available, otherwise use exponential backoff
          const retryAfter = (err as { headers?: Record<string, string> }).headers?.['retry-after']
          const baseDelay = retryAfter ? Number(retryAfter) * 1000 : 2000 * Math.pow(2, attempt)
          // Add jitter (±25%) to avoid thundering herd
          const jitter = baseDelay * 0.25 * (2 * Math.random() - 1)
          const delay = Math.max(1000, Math.round(baseDelay + jitter))

          console.info(
            `[ClaudeClient] Rate limited (${status}), retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`,
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        throw err
      }
    }

    throw lastError
  }

  private parseJson<T>(text: string): T {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    return JSON.parse(cleaned) as T
  }

  // ─── Summarize a filing section ─────────────────────────────────────

  async summarizeSection(params: {
    section: string
    sectionType: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = sectionSummarySystemPrompt(params.sectionType)
    const userPrompt = sectionSummaryUserPrompt({
      section: params.section,
      sectionType: params.sectionType,
      companyName: params.companyName,
      filingType: params.filingType,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)

    return { data: text, usage, cached: false }
  }

  // ─── Generate comprehensive filing summary ─────────────────────────

  async generateFilingSummary(params: {
    rawData: Record<string, unknown>
    filingType: string
    companyName: string
  }): Promise<AiResponse<FilingSummaryResult>> {
    // Truncate raw data to fit context window — keep most important fields
    const dataStr = truncateForContext(JSON.stringify(params.rawData, null, 2))

    const systemPrompt = filingSummarySystemPrompt()
    const userPrompt = filingSummaryUserPrompt({
      companyName: params.companyName,
      filingType: params.filingType,
      rawData: dataStr,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt)
    const data = this.parseJson<FilingSummaryResult>(text)

    return { data, usage, cached: false }
  }

  // ─── Compensation analysis ──────────────────────────────────────────

  async generateCompensationAnalysis(params: {
    execComp: Array<Record<string, unknown>>
    userPay?: number
    companyFinancials?: Record<string, unknown>
    costOfLiving?: Record<string, number | null>
    companyName: string
  }): Promise<AiResponse<CompensationAnalysisResult>> {
    const systemPrompt = compensationAnalysisSystemPrompt()
    const userPrompt = compensationAnalysisUserPrompt({
      companyName: params.companyName,
      execComp: JSON.stringify(params.execComp, null, 2),
      userPay: params.userPay,
      costOfLiving: params.costOfLiving,
      companyFinancials: params.companyFinancials
        ? JSON.stringify(params.companyFinancials, null, 2)
        : undefined,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt)
    const data = this.parseJson<CompensationAnalysisResult>(text)

    return { data, usage, cached: false }
  }

  // ─── Embeddings (Ollama or OpenAI) ──────────────────────────────────

  async generateEmbedding(params: { text: string }): Promise<Array<number>> {
    if (this.embeddingProvider === 'ollama') {
      return this.generateOllamaEmbedding(params.text)
    }
    return this.generateOpenAiEmbedding(params.text)
  }

  private async generateOllamaEmbedding(text: string): Promise<Array<number>> {
    const url = `${this.ollamaBaseUrl}/api/embeddings`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.ollamaEmbeddingModel,
        prompt: text,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Ollama embeddings error ${response.status}: ${body}`)
    }

    const result = (await response.json()) as { embedding: Array<number> }

    console.info(
      `[ClaudeClient] embedding (ollama/${this.ollamaEmbeddingModel}) — ${text.length} chars`,
    )

    return result.embedding
  }

  private async generateOpenAiEmbedding(text: string): Promise<Array<number>> {
    if (!this.openaiApiKey) {
      throw new Error(
        'OpenAI API key required for embeddings. Set OPENAI_API_KEY or pass openaiApiKey in config.',
      )
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_EMBEDDING_MODEL,
        input: text,
        dimensions: OPENAI_EMBEDDING_DIMENSIONS,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`OpenAI embeddings API error ${response.status}: ${body}`)
    }

    const result = (await response.json()) as {
      data: Array<{ embedding: Array<number> }>
      usage: { total_tokens: number }
    }

    console.info(
      `[ClaudeClient] embedding (openai) — ${result.usage.total_tokens} tokens`,
    )

    return result.data[0].embedding
  }

  // ─── RAG query ──────────────────────────────────────────────────────

  async ragQuery(params: {
    query: string
    context: Array<string>
  }): Promise<AiResponse<string>> {
    const systemPrompt = ragAnswerSystemPrompt()
    const userPrompt = ragAnswerUserPrompt({
      query: params.query,
      context: params.context,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)

    return { data: text, usage, cached: false }
  }
}

/**
 * Truncate a JSON string to fit within ~100k characters (~25k tokens).
 * Keeps the beginning and end for context, marking the middle as truncated.
 */
function truncateForContext(text: string, maxChars = 100_000): string {
  if (text.length <= maxChars) return text
  const half = Math.floor(maxChars / 2)
  return (
    text.slice(0, half) +
    '\n\n... [CONTENT TRUNCATED FOR CONTEXT WINDOW] ...\n\n' +
    text.slice(-half)
  )
}
