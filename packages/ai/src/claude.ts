import Anthropic from '@anthropic-ai/sdk'
import { extractJson } from './extract-json'
import {
  compensationAnalysisSystemPrompt,
  compensationAnalysisUserPrompt,
  type CompensationFairnessResult,
} from './prompts/compensation-analysis'
import { ragAnswerSystemPrompt, ragAnswerUserPrompt } from './prompts/rag-answer'
import {
  companySummarySystemPrompt,
  companySummaryUserPrompt,
} from './prompts/company-summary'
import {
  employeeImpactSystemPrompt,
  employeeImpactUserPrompt,
} from './prompts/employee-impact'
import {
  workforceSignalsSystemPrompt,
  workforceSignalsUserPrompt,
} from './prompts/workforce-signals'
import {
  mdaSummarySystemPrompt,
  mdaSummaryUserPrompt,
} from './prompts/mda-summary'
import {
  businessOverviewSummarySystemPrompt,
  businessOverviewSummaryUserPrompt,
} from './prompts/business-overview'
import {
  riskFactorsSummarySystemPrompt,
  riskFactorsSummaryUserPrompt,
} from './prompts/risk-factors'
import {
  legalProceedingsSummarySystemPrompt,
  legalProceedingsSummaryUserPrompt,
} from './prompts/legal-proceedings'
import {
  financialFootnotesSummarySystemPrompt,
  financialFootnotesSummaryUserPrompt,
} from './prompts/financial-footnotes'
import {
  executiveCompensationSummarySystemPrompt,
  executiveCompensationSummaryUserPrompt,
} from './prompts/executive-compensation'
import {
  cybersecuritySummarySystemPrompt,
  cybersecuritySummaryUserPrompt,
} from './prompts/cybersecurity'
import {
  controlsAndProceduresSummarySystemPrompt,
  controlsAndProceduresSummaryUserPrompt,
} from './prompts/controls-and-procedures'
import {
  relatedTransactionsSummarySystemPrompt,
  relatedTransactionsSummaryUserPrompt,
} from './prompts/related-transactions'
import {
  proxySummarySystemPrompt,
  proxySummaryUserPrompt,
} from './prompts/proxy'
import {
  event8kSummarySystemPrompt,
  event8kSummaryUserPrompt,
} from './prompts/event-8k'
import {
  narrativeSummarySystemPrompt,
  narrativeSummaryUserPrompt,
} from './prompts/narrative'
import {
  whatThisMeansSystemPrompt,
  whatThisMeansUserPrompt,
} from './prompts/what-this-means'
import type {
  AiResponse,
  ClaudeClientConfig,
  CompanySummaryResult,
  EmployeeOutlookResult,
  TokenUsage,
  WorkforceSignalsResult,
} from './types'

const DEFAULT_MODEL = 'claude-haiku-4-5'
const DEFAULT_MAX_TOKENS = 4096

// Voyage AI embedding config
const DEFAULT_VOYAGE_EMBEDDING_MODEL = 'voyage-4-lite'
const VOYAGE_EMBEDDING_DIMENSIONS = 1024

/**
 * Claude API client for SEC filing analysis, compensation insights, and RAG.
 *
 * Uses Claude for text generation. Embeddings via Voyage AI:
 * - Default: voyage-4-lite (dev), 1024 dimensions
 * - Production: voyage-finance-2 (financial domain), 1024 dimensions
 */
export class ClaudeClient {
  private readonly anthropic: Anthropic
  private readonly model: string
  private readonly voyageApiKey: string | undefined
  private readonly voyageModel: string

  constructor(config: ClaudeClientConfig) {
    this.anthropic = new Anthropic({ apiKey: config.apiKey })
    this.model = config.model ?? DEFAULT_MODEL
    this.voyageApiKey = config.voyageApiKey ?? process.env.VOYAGE_API_KEY
    this.voyageModel =
      config.voyageModel ?? process.env.VOYAGE_EMBEDDING_MODEL ?? DEFAULT_VOYAGE_EMBEDDING_MODEL
  }

  /** Returns the embedding dimensions (1024 for all Voyage AI models). */
  get embeddingDimensions(): number {
    return VOYAGE_EMBEDDING_DIMENSIONS
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
    return extractJson<T>(text)
  }

  // ─── Narrative (catch-all) summary ─────────────────────────────────

  async summarizeNarrative(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = narrativeSummarySystemPrompt()
    const userPrompt = narrativeSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Compensation analysis ──────────────────────────────────────────
  // Mirrors the production /api/analysis/compensation-fairness Edge Function
  // contract: 1–10 fairness score, JSON shape with summary/detailed_analysis/
  // key_findings. See SCALE DECISION note in prompts/compensation-analysis.ts.

  async generateCompensationAnalysis(params: {
    companyName: string
    companyTicker: string
    companySector?: string | null
    execComp: Array<Record<string, unknown>>
    /** User pay in cents (matches DB shape). */
    userPayCents: number
    userJobTitle?: string | null
    companyFinancials?: Record<string, unknown>
    costOfLiving?: Record<string, number | null>
  }): Promise<AiResponse<CompensationFairnessResult>> {
    const systemPrompt = compensationAnalysisSystemPrompt()
    const userPrompt = compensationAnalysisUserPrompt({
      companyName: params.companyName,
      companyTicker: params.companyTicker,
      companySector: params.companySector ?? null,
      execComp: params.execComp,
      userPayCents: params.userPayCents,
      userJobTitle: params.userJobTitle ?? null,
      companyFinancials: params.companyFinancials ?? {},
      costOfLiving: params.costOfLiving ?? {},
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt)
    const data = this.parseJson<CompensationFairnessResult>(text)

    return { data, usage, cached: false }
  }

  // ─── Company summary (structured health assessment) ────────────────

  async generateCompanySummary(params: {
    aggregatedSections: string
    filingType: string
    companyName: string
  }): Promise<AiResponse<CompanySummaryResult>> {
    const systemPrompt = companySummarySystemPrompt()
    const userPrompt = companySummaryUserPrompt({
      companyName: params.companyName,
      filingType: params.filingType,
      aggregatedSections: params.aggregatedSections,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt)
    const data = this.parseJson<CompanySummaryResult>(text)

    return { data, usage, cached: false }
  }

  // ─── Employee impact (outlook only) ───────────────────────────────
  // Returns the outlook portion of EmployeeImpactResult (job security,
  // compensation, growth, watch_items). The summarisation pipeline merges
  // this with generateWorkforceSignals output before storing on
  // filing_summaries.ai_summary.employee_impact.

  async generateEmployeeImpact(params: {
    aggregatedSections: string
    filingType: string
    companyName: string
  }): Promise<AiResponse<EmployeeOutlookResult>> {
    const systemPrompt = employeeImpactSystemPrompt()
    const userPrompt = employeeImpactUserPrompt({
      companyName: params.companyName,
      filingType: params.filingType,
      aggregatedSections: params.aggregatedSections,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt)
    const data = this.parseJson<EmployeeOutlookResult>(text)

    return { data, usage, cached: false }
  }

  // ─── Workforce signals (geography + visa dependency) ──────────────
  // Runs against raw business_overview + risk_factors text (not summaries)
  // because direct quotes and exact figures matter for these signals.

  async generateWorkforceSignals(params: {
    companyName: string
    filingType: string
    businessOverview: string | null
    riskFactors: string | null
  }): Promise<AiResponse<WorkforceSignalsResult>> {
    const systemPrompt = workforceSignalsSystemPrompt()
    const userPrompt = workforceSignalsUserPrompt({
      companyName: params.companyName,
      filingType: params.filingType,
      businessOverview: params.businessOverview,
      riskFactors: params.riskFactors,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt)
    const data = this.parseJson<WorkforceSignalsResult>(text)

    return { data, usage, cached: false }
  }

  // ─── MD&A summary (structured markdown) ───────────────────────────

  async summarizeMda(params: {
    mdaText: string
    companyName: string
    filingType: string
    priorMdaText?: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = mdaSummarySystemPrompt()
    const userPrompt = mdaSummaryUserPrompt({
      companyName: params.companyName,
      filingType: params.filingType,
      mdaText: params.mdaText,
      priorMdaText: params.priorMdaText,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt, 3072)

    return { data: text, usage, cached: false }
  }

  // ─── Business Overview summary ─────────────────────────────────────

  async summarizeBusinessOverview(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = businessOverviewSummarySystemPrompt()
    const userPrompt = businessOverviewSummaryUserPrompt({
      section: params.section,
      companyName: params.companyName,
      filingType: params.filingType,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)

    return { data: text, usage, cached: false }
  }

  // ─── Risk Factors summary ──────────────────────────────────────────

  async summarizeRiskFactors(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = riskFactorsSummarySystemPrompt()
    const userPrompt = riskFactorsSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Legal Proceedings summary ─────────────────────────────────────

  async summarizeLegalProceedings(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = legalProceedingsSummarySystemPrompt()
    const userPrompt = legalProceedingsSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Financial Footnotes summary ───────────────────────────────────

  async summarizeFinancialFootnotes(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = financialFootnotesSummarySystemPrompt()
    const userPrompt = financialFootnotesSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Executive Compensation summary ────────────────────────────────

  async summarizeExecutiveCompensation(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = executiveCompensationSummarySystemPrompt()
    const userPrompt = executiveCompensationSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Cybersecurity summary ─────────────────────────────────────────

  async summarizeCybersecurity(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = cybersecuritySummarySystemPrompt()
    const userPrompt = cybersecuritySummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Controls and Procedures summary ───────────────────────────────

  async summarizeControlsAndProcedures(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = controlsAndProceduresSummarySystemPrompt()
    const userPrompt = controlsAndProceduresSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Related Transactions summary ──────────────────────────────────

  async summarizeRelatedTransactions(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = relatedTransactionsSummarySystemPrompt()
    const userPrompt = relatedTransactionsSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Proxy summary ─────────────────────────────────────────────────

  async summarizeProxy(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = proxySummarySystemPrompt()
    const userPrompt = proxySummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── 8-K Event summary ─────────────────────────────────────────────
  // The caller is expected to prefix `params.section` with the section's
  // friendly name (e.g. "Item 5.02 — Departure of Directors:\n…"). The
  // friendly-name lookup lives in `@younionize/sec-api`; the pipeline
  // computes the prefix to avoid a cross-package import.

  async summarize8kEvent(params: {
    section: string
    companyName: string
    filingType: string
  }): Promise<AiResponse<string>> {
    const systemPrompt = event8kSummarySystemPrompt()
    const userPrompt = event8kSummaryUserPrompt(params)
    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)
    return { data: text, usage, cached: false }
  }

  // ─── Personalized "What This Means" overlay ───────────────────────

  async generateWhatThisMeans(params: {
    companyName: string
    filingType: string
    companySummary: string
    keyNumbers: string
    userJobTitle?: string
    /** Annual pay in dollars. */
    userAnnualPay?: number
  }): Promise<AiResponse<string>> {
    const systemPrompt = whatThisMeansSystemPrompt()
    const userPrompt = whatThisMeansUserPrompt({
      companyName: params.companyName,
      filingType: params.filingType,
      companySummary: params.companySummary,
      keyNumbers: params.keyNumbers,
      userJobTitle: params.userJobTitle,
      userAnnualPay: params.userAnnualPay,
    })

    const { text, usage } = await this.chat(systemPrompt, userPrompt, 2048)

    return { data: text, usage, cached: false }
  }

  // ─── Embeddings (Voyage AI) ─────────────────────────────────────────

  async generateEmbedding(params: {
    text: string
    /** Use 'document' when storing, 'query' when searching. Defaults to 'document'. */
    inputType?: 'document' | 'query'
  }): Promise<Array<number>> {
    if (!this.voyageApiKey) {
      throw new Error(
        'Voyage AI API key required for embeddings. Set VOYAGE_API_KEY or pass voyageApiKey in config.',
      )
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.voyageApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.voyageModel,
        input: params.text,
        input_type: params.inputType ?? 'document',
        output_dimension: VOYAGE_EMBEDDING_DIMENSIONS,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Voyage AI embeddings error ${response.status}: ${body}`)
    }

    const result = (await response.json()) as {
      data: Array<{ embedding: Array<number> }>
      usage: { total_tokens: number }
    }

    console.info(
      `[ClaudeClient] embedding (voyage/${this.voyageModel}) — ${result.usage.total_tokens} tokens`,
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
