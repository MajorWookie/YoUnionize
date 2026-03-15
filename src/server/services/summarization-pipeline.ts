import { createHash } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import {
  getDb,
  companies,
  filingSummaries,
  embeddings,
  executiveCompensation,
} from '@union/postgres'
import { CURRENT_SUMMARY_VERSION } from '@union/ai'
import type { ClaudeClient } from '@union/ai'
import { getAiClient } from '../ai-client'
import { transformXbrlToStatements } from './xbrl-transformer'
import type { FinancialStatement } from './xbrl-transformer'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SummarizationResult {
  total: number
  summarized: number
  skipped: number
  errors: Array<string>
  tokenUsage: { inputTokens: number; outputTokens: number }
}

interface FilingRow {
  id: string
  filingType: string
  accessionNumber: string
  rawData: Record<string, unknown>
  aiSummary: unknown
  summaryVersion: number | null
}

// ─── Sections per filing type ───────────────────────────────────────────────

const FILING_SECTIONS: Record<string, Array<string>> = {
  '10-K': [
    'executive_summary',
    'income_statement',
    'balance_sheet',
    'cash_flow',
    'shareholders_equity',
    'mda',
    'risk_factors',
    'business_overview',
    'legal_proceedings',
    'footnotes',
  ],
  '10-Q': [
    'executive_summary',
    'income_statement',
    'balance_sheet',
    'cash_flow',
    'mda',
  ],
  '8-K': ['event_summary'],
  'DEF 14A': [
    'executive_compensation',
    'board_composition',
    'shareholder_proposals',
  ],
}

const STRUCTURED_SECTIONS = new Set([
  'income_statement',
  'balance_sheet',
  'cash_flow',
  'shareholders_equity',
])

const SECTION_TO_RAW_KEY: Record<string, string> = {
  mda: 'mdAndA',
  risk_factors: 'riskFactors',
  business_overview: 'businessOverview',
  legal_proceedings: 'legalProceedings',
}

// ─── Main pipeline ─────────────────────────────────────────────────────────

/**
 * Summarize all unsummarized filings for a company.
 * Processes sequentially to respect Claude API rate limits.
 */
export async function summarizeCompanyFilings(
  companyId: string,
  companyName: string,
): Promise<SummarizationResult> {
  const db = getDb()
  const ai = getAiClient()

  const result: SummarizationResult = {
    total: 0,
    summarized: 0,
    skipped: 0,
    errors: [],
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
  }

  // Query unsummarized filings
  const filings = await db
    .select({
      id: filingSummaries.id,
      filingType: filingSummaries.filingType,
      accessionNumber: filingSummaries.accessionNumber,
      rawData: filingSummaries.rawData,
      aiSummary: filingSummaries.aiSummary,
      summaryVersion: filingSummaries.summaryVersion,
    })
    .from(filingSummaries)
    .where(
      and(
        eq(filingSummaries.companyId, companyId),
        isNull(filingSummaries.aiSummary),
      ),
    )

  result.total = filings.length

  if (filings.length === 0) {
    console.info(`[Summarize] No unsummarized filings for ${companyName}`)
    return result
  }

  console.info(
    `[Summarize] Processing ${filings.length} filings for ${companyName}`,
  )

  // Process sequentially to respect rate limits
  for (const filing of filings as Array<FilingRow>) {
    try {
      await summarizeSingleFiling(filing, companyId, companyName, ai, result)
      result.summarized++
    } catch (err) {
      const msg = `${filing.filingType} ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`
      console.info(`[Summarize] Failed — ${msg}`)
      result.errors.push(msg)
    }
  }

  console.info(
    `[Summarize] Done for ${companyName}: ${result.summarized}/${result.total} summarized, ` +
      `${result.tokenUsage.inputTokens} input tokens, ${result.tokenUsage.outputTokens} output tokens`,
  )

  return result
}

// ─── Single filing summarization ────────────────────────────────────────────

async function summarizeSingleFiling(
  filing: FilingRow,
  companyId: string,
  companyName: string,
  ai: ClaudeClient,
  result: SummarizationResult,
): Promise<void> {
  const db = getDb()
  const rawData = filing.rawData as Record<string, unknown>
  const sections = FILING_SECTIONS[filing.filingType] ?? ['executive_summary']
  const aiSummary: Record<string, unknown> = {}

  console.info(
    `[Summarize] ${filing.filingType} ${filing.accessionNumber} — ${sections.length} sections`,
  )

  for (const section of sections) {
    try {
      if (STRUCTURED_SECTIONS.has(section)) {
        // Financial statements: transform XBRL data, no AI needed
        const xbrlData = rawData.xbrlData as Record<string, unknown> | undefined
        if (xbrlData) {
          const statements = transformXbrlToStatements(xbrlData)
          if (statements[section]) {
            aiSummary[section] = statements[section]
          }
        }
      } else if (section === 'executive_compensation') {
        // DEF 14A: combine structured comp data with AI analysis
        aiSummary[section] = await summarizeExecutiveCompensation(
          companyId,
          companyName,
          rawData,
          ai,
          result,
        )
      } else if (section === 'executive_summary') {
        // Generate overall filing summary via AI
        const response = await ai.generateFilingSummary({
          rawData,
          filingType: filing.filingType,
          companyName,
        })
        aiSummary[section] = response.data
        result.tokenUsage.inputTokens += response.usage.inputTokens
        result.tokenUsage.outputTokens += response.usage.outputTokens
      } else if (section === 'event_summary') {
        // 8-K: summarize the event based on item types
        const sectionText = buildEightKContext(rawData)
        if (sectionText) {
          const response = await ai.summarizeSection({
            section: sectionText,
            sectionType: 'event_summary',
            companyName,
            filingType: '8-K',
          })
          aiSummary[section] = response.data
          result.tokenUsage.inputTokens += response.usage.inputTokens
          result.tokenUsage.outputTokens += response.usage.outputTokens
        }
      } else {
        // Unstructured sections: send extracted text to Claude
        const sectionSummary = await summarizeUnstructuredSection(
          section,
          rawData,
          companyName,
          filing.filingType,
          ai,
          result,
        )
        if (sectionSummary) {
          aiSummary[section] = sectionSummary
        }
      }
    } catch (err) {
      const msg = `Section "${section}": ${err instanceof Error ? err.message : String(err)}`
      console.info(`[Summarize] Skipping — ${msg}`)
      aiSummary[section] = { error: msg }
    }
  }

  // Update the filing record
  await db
    .update(filingSummaries)
    .set({
      aiSummary,
      summaryVersion: CURRENT_SUMMARY_VERSION,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(filingSummaries.id, filing.id))

  // Generate embeddings for text-based summary sections (async, non-blocking)
  const embeddingCtx = await getEmbeddingContext(companyId, filing)
  generateSectionEmbeddings(filing.id, aiSummary, ai, embeddingCtx).catch((err) => {
    console.info(
      `[Summarize] Embedding generation failed for ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`,
    )
  })
}

// ─── Unstructured section summarization ─────────────────────────────────────

async function summarizeUnstructuredSection(
  section: string,
  rawData: Record<string, unknown>,
  companyName: string,
  filingType: string,
  ai: ClaudeClient,
  result: SummarizationResult,
): Promise<string | null> {
  const extractedSections = rawData.extractedSections as
    | Record<string, string>
    | undefined

  // Map section name to raw data key
  const rawKey = SECTION_TO_RAW_KEY[section] ?? section
  const sectionText = extractedSections?.[rawKey]

  if (!sectionText || sectionText.trim().length === 0) {
    return null
  }

  // Map pipeline section names to ClaudeClient section types
  const sectionTypeMap: Record<string, string> = {
    mda: 'mdAndA',
    risk_factors: 'riskFactors',
    business_overview: 'businessOverview',
    legal_proceedings: 'legalProceedings',
    footnotes: 'financialStatements',
    board_composition: 'businessOverview',
    shareholder_proposals: 'legalProceedings',
  }

  const response = await ai.summarizeSection({
    section: sectionText,
    sectionType: sectionTypeMap[section] ?? section,
    companyName,
    filingType,
  })

  result.tokenUsage.inputTokens += response.usage.inputTokens
  result.tokenUsage.outputTokens += response.usage.outputTokens

  return response.data
}

// ─── Executive compensation analysis ────────────────────────────────────────

interface ExecCompSummary {
  top5: Array<{
    name: string
    title: string
    totalCompensation: number
    salary: number | null
    stockAwards: number | null
  }>
  ceoPayRatio: string | null
  employeeCompAsRiskFactor: boolean
  analysis: string | null
}

async function summarizeExecutiveCompensation(
  companyId: string,
  companyName: string,
  rawData: Record<string, unknown>,
  ai: ClaudeClient,
  result: SummarizationResult,
): Promise<ExecCompSummary> {
  const db = getDb()

  // Get structured comp data from the database
  const compData = await db
    .select()
    .from(executiveCompensation)
    .where(eq(executiveCompensation.companyId, companyId))
    .orderBy(executiveCompensation.totalCompensation)
    .limit(20)

  // Sort descending by total comp and take top 5
  const sorted = [...compData].sort(
    (a, b) => b.totalCompensation - a.totalCompensation,
  )
  const top5 = sorted.slice(0, 5).map((e) => ({
    name: e.executiveName,
    title: e.title,
    totalCompensation: e.totalCompensation,
    salary: e.salary,
    stockAwards: e.stockAwards,
  }))

  // Find CEO pay ratio
  const ceoPayRatio =
    compData.find((e) => e.ceoPayRatio != null)?.ceoPayRatio ?? null

  // Check if employee compensation is mentioned as a risk factor
  const extractedSections = rawData.extractedSections as
    | Record<string, string>
    | undefined
  const riskFactorsText = extractedSections?.riskFactors ?? ''
  const employeeCompAsRiskFactor =
    /employee.{0,30}compensation|talent.{0,20}retention|labor.{0,20}cost|wage.{0,20}pressure/i.test(
      riskFactorsText,
    )

  // Generate AI analysis of the proxy statement if we have section text
  let analysis: string | null = null
  const proxyText =
    extractedSections?.executiveCompensation ??
    extractedSections?.proxy ??
    null

  if (proxyText || compData.length > 0) {
    try {
      const contextText = proxyText ?? JSON.stringify(top5, null, 2)
      const response = await ai.summarizeSection({
        section: contextText,
        sectionType: 'executiveCompensation',
        companyName,
        filingType: 'DEF 14A',
      })
      analysis = response.data
      result.tokenUsage.inputTokens += response.usage.inputTokens
      result.tokenUsage.outputTokens += response.usage.outputTokens
    } catch (err) {
      console.info(
        `[Summarize] Exec comp AI analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { top5, ceoPayRatio, employeeCompAsRiskFactor, analysis }
}

// ─── 8-K context builder ───────────────────────────────────────────────────

function buildEightKContext(rawData: Record<string, unknown>): string | null {
  const parts: Array<string> = []

  if (rawData.description) {
    parts.push(`Event description: ${rawData.description}`)
  }

  if (rawData.formType) {
    parts.push(`Form type: ${rawData.formType}`)
  }

  // Include any extracted section text
  const extracted = rawData.extractedSections as
    | Record<string, string>
    | undefined
  if (extracted) {
    for (const [key, text] of Object.entries(extracted)) {
      if (text && text.trim().length > 0) {
        parts.push(`${key}:\n${text}`)
      }
    }
  }

  // Include raw filing details for context
  const fieldsToInclude = [
    'companyName',
    'ticker',
    'filedAt',
    'periodOfReport',
  ] as const
  for (const field of fieldsToInclude) {
    if (rawData[field]) {
      parts.push(`${field}: ${rawData[field]}`)
    }
  }

  if (parts.length === 0) {
    // Fall back to a truncated version of the raw data
    const raw = JSON.stringify(rawData, null, 2)
    if (raw.length > 100) {
      return raw.slice(0, 5000)
    }
    return null
  }

  return parts.join('\n\n')
}

// ─── Embedding context helper ───────────────────────────────────────────────

async function getEmbeddingContext(
  companyId: string,
  filing: FilingRow,
): Promise<EmbeddingContext> {
  const db = getDb()
  const [company] = await db
    .select({ ticker: companies.ticker })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)

  const rawData = filing.rawData as Record<string, unknown>
  return {
    companyId,
    companyTicker: company?.ticker ?? '',
    filingType: filing.filingType,
    periodEnd: (rawData.periodOfReport as string) ?? null,
  }
}

// ─── Text chunking ──────────────────────────────────────────────────────────

const CHUNK_SIZE = 500 // ~500 tokens ≈ 2000 chars
const CHUNK_OVERLAP = 50 // ~50 tokens ≈ 200 chars
const CHARS_PER_TOKEN = 4 // rough estimate

/**
 * Split text into overlapping chunks of ~500 tokens.
 * Returns an array of chunks. Short texts (< CHUNK_SIZE tokens) return a single chunk.
 */
export function chunkText(text: string): Array<string> {
  const maxChars = CHUNK_SIZE * CHARS_PER_TOKEN
  const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOKEN

  if (text.length <= maxChars) return [text]

  const chunks: Array<string> = []
  let start = 0

  while (start < text.length) {
    let end = start + maxChars

    // Try to break at a sentence or paragraph boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 200)
      const breakPoints = [
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('.\n'),
      ]
      const best = Math.max(...breakPoints.filter((p) => p > maxChars * 0.5))
      if (best > 0) {
        end = start + best + 1
      }
    }

    chunks.push(text.slice(start, Math.min(end, text.length)).trim())
    start = end - overlapChars
  }

  return chunks.filter((c) => c.length > 0)
}

// ─── Embedding generation ───────────────────────────────────────────────────

interface EmbeddingContext {
  companyId: string
  companyTicker: string
  filingType: string
  periodEnd: string | null
}

async function generateSectionEmbeddings(
  filingId: string,
  aiSummary: Record<string, unknown>,
  ai: ClaudeClient,
  ctx?: EmbeddingContext,
): Promise<void> {
  const db = getDb()

  for (const [section, content] of Object.entries(aiSummary)) {
    // Skip structured data and error entries
    if (content == null) continue
    if (typeof content === 'object' && 'error' in (content as Record<string, unknown>)) continue

    // Get the text to embed
    let text: string
    if (typeof content === 'string') {
      text = content
    } else if (
      typeof content === 'object' &&
      content !== null &&
      'executive_summary' in (content as Record<string, unknown>)
    ) {
      const summary = content as Record<string, unknown>
      text = [
        summary.executive_summary,
        summary.plain_language_explanation,
        summary.employee_relevance,
      ]
        .filter(Boolean)
        .join('\n\n')
    } else if (
      typeof content === 'object' &&
      content !== null &&
      'analysis' in (content as Record<string, unknown>)
    ) {
      text = (content as Record<string, unknown>).analysis as string
      if (!text) continue
    } else if (STRUCTURED_SECTIONS.has(section)) {
      const statement = content as FinancialStatement
      if (!statement.items) continue
      text = `${statement.title}: ` +
        statement.items
          .filter((item) => item.current != null)
          .map(
            (item) =>
              `${item.label}: ${formatNumber(item.current)}` +
              (item.changePercent != null ? ` (${item.changePercent > 0 ? '+' : ''}${item.changePercent}%)` : ''),
          )
          .join(', ')
    } else {
      continue
    }

    if (!text || text.trim().length < 50) continue

    // Chunk the text for better retrieval granularity
    const chunks = chunkText(text)

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx]
      const contentHash = createHash('sha256').update(chunk).digest('hex')

      // Check if embedding already exists
      const existing = await db
        .select({ id: embeddings.id })
        .from(embeddings)
        .where(
          and(
            eq(embeddings.sourceId, filingId),
            eq(embeddings.contentHash, contentHash),
          ),
        )
        .limit(1)

      if (existing.length > 0) continue

      try {
        const vector = await ai.generateEmbedding({ text: chunk })

        await db.insert(embeddings).values({
          sourceType: 'filing_summary',
          sourceId: filingId,
          contentHash,
          embedding: vector,
          metadata: {
            section,
            filingId,
            chunkIndex: chunkIdx,
            totalChunks: chunks.length,
            ...(ctx
              ? {
                  companyId: ctx.companyId,
                  companyTicker: ctx.companyTicker,
                  filingType: ctx.filingType,
                  periodEnd: ctx.periodEnd,
                }
              : {}),
          },
        })
      } catch (err) {
        console.info(
          `[Summarize] Embedding failed for ${section} chunk ${chunkIdx}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }
}

function formatNumber(value: number | null): string {
  if (value == null) return 'N/A'
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

// ─── Status check ───────────────────────────────────────────────────────────

export interface SummaryStatus {
  total: number
  summarized: number
  pending: number
  filings: Array<{
    id: string
    filingType: string
    accessionNumber: string
    hasSummary: boolean
    summaryVersion: number | null
  }>
}

export async function getSummaryStatus(companyId: string): Promise<SummaryStatus> {
  const db = getDb()

  const filings = await db
    .select({
      id: filingSummaries.id,
      filingType: filingSummaries.filingType,
      accessionNumber: filingSummaries.accessionNumber,
      aiSummary: filingSummaries.aiSummary,
      summaryVersion: filingSummaries.summaryVersion,
    })
    .from(filingSummaries)
    .where(eq(filingSummaries.companyId, companyId))

  const summarized = filings.filter((f) => f.aiSummary != null).length

  return {
    total: filings.length,
    summarized,
    pending: filings.length - summarized,
    filings: filings.map((f) => ({
      id: f.id,
      filingType: f.filingType,
      accessionNumber: f.accessionNumber,
      hasSummary: f.aiSummary != null,
      summaryVersion: f.summaryVersion,
    })),
  }
}
