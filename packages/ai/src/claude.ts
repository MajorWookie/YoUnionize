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

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = 4096
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Claude API client for SEC filing analysis, compensation insights, and RAG.
 *
 * Uses Claude for text generation and OpenAI for embeddings (text-embedding-3-small,
 * 1536 dimensions to match pgvector schema).
 */
export class ClaudeClient {
  private readonly anthropic: Anthropic
  private readonly model: string
  private readonly openaiApiKey: string | undefined

  constructor(config: ClaudeClientConfig) {
    this.anthropic = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model ?? DEFAULT_MODEL
    this.openaiApiKey = config.openaiApiKey ?? process.env.OPENAI_API_KEY
  }

  // ─── Core Claude call ───────────────────────────────────────────────

  private async chat(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = DEFAULT_MAX_TOKENS,
  ): Promise<{ text: string; usage: TokenUsage }> {
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

  // ─── Embeddings (OpenAI text-embedding-3-small) ─────────────────────

  async generateEmbedding(params: { text: string }): Promise<Array<number>> {
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
        model: EMBEDDING_MODEL,
        input: params.text,
        dimensions: EMBEDDING_DIMENSIONS,
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
      `[ClaudeClient] embedding — ${result.usage.total_tokens} tokens`,
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
