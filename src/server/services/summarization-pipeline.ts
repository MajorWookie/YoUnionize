import { createHash } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import {
  getDb,
  companies,
  filingSummaries,
  embeddings,
  executiveCompensation,
} from '@younionize/postgres'
import { CURRENT_SUMMARY_VERSION } from '@younionize/ai'
import type { ClaudeClient } from '@younionize/ai'
import { pMapSettled } from '@younionize/helpers'
import { getAiClient } from '../ai-client'
import { transformXbrlToStatements } from './xbrl-transformer'
import type { FinancialStatement } from './xbrl-transformer'

// ─── Concurrency limits ──────────────────────────────────────────────────────

/** Max filings summarized in parallel per company */
const FILING_CONCURRENCY = 1
/** Max Claude section calls in parallel per filing */
const SECTION_CONCURRENCY = 3
/** Max embedding API calls in parallel per filing */
const EMBEDDING_CONCURRENCY = 6

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
    'employee_impact',
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
    'employee_impact',
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

  // Process filings with bounded concurrency
  const settled = await pMapSettled(
    filings as Array<FilingRow>,
    async (filing) => {
      const usage = await summarizeSingleFiling(filing, companyId, companyName, ai)
      return { filing, usage }
    },
    FILING_CONCURRENCY,
  )

  for (const entry of settled) {
    if (entry.status === 'fulfilled') {
      result.summarized++
      result.tokenUsage.inputTokens += entry.value.usage.inputTokens
      result.tokenUsage.outputTokens += entry.value.usage.outputTokens
    } else {
      const msg = `${(entry.reason as Error)?.message ?? String(entry.reason)}`
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
): Promise<{ inputTokens: number; outputTokens: number }> {
  const db = getDb()
  const rawData = filing.rawData as Record<string, unknown>
  const sections = FILING_SECTIONS[filing.filingType] ?? ['executive_summary']
  const aiSummary: Record<string, unknown> = {}
  let inputTokens = 0
  let outputTokens = 0

  console.info(
    `[Summarize] ${filing.filingType} ${filing.accessionNumber} — ${sections.length} sections`,
  )

  // Separate sync (XBRL) sections from async (AI) sections
  const aiSections: Array<string> = []
  for (const section of sections) {
    if (STRUCTURED_SECTIONS.has(section)) {
      const xbrlData = rawData.xbrlData as Record<string, unknown> | undefined
      if (xbrlData) {
        const statements = transformXbrlToStatements(xbrlData)
        if (statements[section]) {
          aiSummary[section] = statements[section]
        }
      }
    } else {
      aiSections.push(section)
    }
  }

  // Process AI sections with bounded concurrency
  const sectionResults = await pMapSettled(
    aiSections,
    async (section) => summarizeSectionDispatch(section, companyId, companyName, rawData, filing.filingType, ai),
    SECTION_CONCURRENCY,
  )

  for (let i = 0; i < aiSections.length; i++) {
    const section = aiSections[i]
    const entry = sectionResults[i]
    if (entry.status === 'fulfilled' && entry.value) {
      aiSummary[section] = entry.value.data
      inputTokens += entry.value.usage.inputTokens
      outputTokens += entry.value.usage.outputTokens
    } else if (entry.status === 'rejected') {
      const msg = `Section "${section}": ${entry.reason instanceof Error ? entry.reason.message : String(entry.reason)}`
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

  // Generate embeddings concurrently (awaited, not fire-and-forget)
  const embeddingCtx = await getEmbeddingContext(companyId, filing)
  await generateSectionEmbeddings(filing.id, aiSummary, ai, embeddingCtx).catch((err) => {
    console.info(
      `[Summarize] Embedding generation failed for ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`,
    )
  })

  return { inputTokens, outputTokens }
}

// ─── Section dispatch (routes to the right summarizer) ────────────────────

interface SectionResult {
  data: unknown
  usage: { inputTokens: number; outputTokens: number }
}

async function summarizeSectionDispatch(
  section: string,
  companyId: string,
  companyName: string,
  rawData: Record<string, unknown>,
  filingType: string,
  ai: ClaudeClient,
): Promise<SectionResult | null> {
  if (section === 'executive_compensation') {
    const data = await summarizeExecutiveCompensation(companyId, companyName, rawData, ai)
    return { data: data.result, usage: data.usage }
  }

  if (section === 'executive_summary') {
    const response = await ai.generateCompanySummary({ rawData, filingType, companyName })
    return { data: response.data, usage: response.usage }
  }

  if (section === 'employee_impact') {
    const extractedSections = rawData.extractedSections as Record<string, string> | undefined
    const response = await ai.generateEmployeeImpact({
      rawData,
      filingType,
      companyName,
      riskFactors: extractedSections?.riskFactors,
      mdaText: extractedSections?.mdAndA,
    })
    return { data: response.data, usage: response.usage }
  }

  if (section === 'mda') {
    const extractedSections = rawData.extractedSections as Record<string, string> | undefined
    const mdaText = extractedSections?.mdAndA
    if (!mdaText || mdaText.trim().length === 0) return null
    const response = await ai.summarizeMda({ mdaText, companyName, filingType })
    return { data: response.data, usage: response.usage }
  }

  if (section === 'event_summary') {
    const sectionText = buildEightKContext(rawData)
    if (!sectionText) return null
    const response = await ai.summarizeSection({
      section: sectionText,
      sectionType: 'event_summary',
      companyName,
      filingType: '8-K',
    })
    return { data: response.data, usage: response.usage }
  }

  // Unstructured sections (risk_factors, business_overview, legal_proceedings, footnotes, etc.)
  return summarizeUnstructuredSection(section, rawData, companyName, filingType, ai)
}

// ─── Unstructured section summarization ─────────────────────────────────────

async function summarizeUnstructuredSection(
  section: string,
  rawData: Record<string, unknown>,
  companyName: string,
  filingType: string,
  ai: ClaudeClient,
): Promise<SectionResult | null> {
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

  return { data: response.data, usage: response.usage }
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
): Promise<{ result: ExecCompSummary; usage: { inputTokens: number; outputTokens: number } }> {
  const db = getDb()
  const usage = { inputTokens: 0, outputTokens: 0 }

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
      usage.inputTokens += response.usage.inputTokens
      usage.outputTokens += response.usage.outputTokens
    } catch (err) {
      console.info(
        `[Summarize] Exec comp AI analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { result: { top5, ceoPayRatio, employeeCompAsRiskFactor, analysis }, usage }
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

const TARGET_CHUNK_TOKENS = 400
const MAX_CHUNK_TOKENS = 600
const CHARS_PER_TOKEN = 4

/**
 * Split text into chunks that respect paragraph boundaries.
 * Prefers complete paragraphs; only splits within a paragraph
 * when a single paragraph exceeds MAX_CHUNK_TOKENS.
 */
export function chunkText(text: string): Array<string> {
  const maxChars = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN
  const targetChars = TARGET_CHUNK_TOKENS * CHARS_PER_TOKEN

  if (text.length <= maxChars) return [text.trim()].filter((c) => c.length > 0)

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0)
  const chunks: Array<string> = []
  let currentParts: Array<string> = []
  let currentLen = 0

  for (const para of paragraphs) {
    const paraLen = para.length

    // If a single paragraph exceeds max, split it by sentences
    if (paraLen > maxChars) {
      if (currentParts.length > 0) {
        chunks.push(currentParts.join('\n\n').trim())
        currentParts = []
        currentLen = 0
      }
      chunks.push(...splitBySentences(para, targetChars, maxChars))
      continue
    }

    // Would adding this paragraph exceed the target?
    if (currentLen + paraLen > targetChars && currentParts.length > 0) {
      chunks.push(currentParts.join('\n\n').trim())
      currentParts = []
      currentLen = 0
    }

    currentParts.push(para)
    currentLen += paraLen
  }

  if (currentParts.length > 0) {
    chunks.push(currentParts.join('\n\n').trim())
  }

  return chunks.filter((c) => c.length > 0)
}

function splitBySentences(
  text: string,
  targetChars: number,
  maxChars: number,
): Array<string> {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) ?? [text]
  const chunks: Array<string> = []
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length > targetChars && current.length > 0) {
      chunks.push(current.trim())
      current = ''
    }
    current += sentence
    if (current.length > maxChars) {
      chunks.push(current.trim())
      current = ''
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim())
  return chunks
}

// ─── Embedding context prefix ───────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  executive_summary: 'Company overview and key takeaways',
  employee_impact: 'Impact on employees',
  mda: 'Management Discussion and Analysis',
  risk_factors: 'Risk factors and potential threats',
  business_overview: 'Business description and operations',
  legal_proceedings: 'Legal proceedings and regulatory matters',
  footnotes: 'Financial statement footnotes',
  event_summary: '8-K material event',
  executive_compensation: 'Executive compensation analysis',
  income_statement: 'Income statement financial data',
  balance_sheet: 'Balance sheet financial data',
  cash_flow: 'Cash flow statement',
  shareholders_equity: 'Shareholders equity statement',
  board_composition: 'Board of directors composition',
  shareholder_proposals: 'Shareholder proposals',
}

function buildEmbeddingText(
  chunk: string,
  section: string,
  ctx: EmbeddingContext | undefined,
): string {
  const sectionLabel = SECTION_LABELS[section] ?? section
  const prefix = ctx
    ? `[${ctx.companyTicker} ${ctx.filingType} | ${sectionLabel}${ctx.periodEnd ? ` | Period: ${ctx.periodEnd}` : ''}]`
    : `[${sectionLabel}]`
  return `${prefix}\n${chunk}`
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

  // Collect all chunks to embed across all sections
  interface ChunkJob {
    section: string
    chunk: string
    contentHash: string
    chunkIndex: number
    totalChunks: number
  }

  const jobs: Array<ChunkJob> = []

  for (const [section, content] of Object.entries(aiSummary)) {
    if (content == null) continue
    if (typeof content === 'object' && 'error' in (content as Record<string, unknown>)) continue

    let text: string
    if (typeof content === 'string') {
      text = content
    } else if (
      typeof content === 'object' &&
      content !== null &&
      'headline' in (content as Record<string, unknown>)
    ) {
      // CompanySummaryResult (v2)
      const summary = content as Record<string, unknown>
      text = [
        summary.headline,
        summary.company_health,
      ]
        .filter(Boolean)
        .join('\n\n')
    } else if (
      typeof content === 'object' &&
      content !== null &&
      'executive_summary' in (content as Record<string, unknown>)
    ) {
      // FilingSummaryResult (v1 backward compat)
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
      'overall_outlook' in (content as Record<string, unknown>)
    ) {
      // EmployeeImpactResult
      const impact = content as Record<string, unknown>
      text = [
        impact.overall_outlook,
        impact.job_security,
        impact.compensation_signals,
        impact.growth_opportunities,
        impact.workforce_geography,
        impact.h1b_and_visa_dependency,
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

    const chunks = chunkText(text)
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const contentHash = createHash('sha256').update(chunks[chunkIdx]).digest('hex')
      jobs.push({ section, chunk: chunks[chunkIdx], contentHash, chunkIndex: chunkIdx, totalChunks: chunks.length })
    }
  }

  if (jobs.length === 0) return

  // Process all embedding jobs with bounded concurrency
  await pMapSettled(
    jobs,
    async (job) => {
      // Check if embedding already exists
      const existing = await db
        .select({ id: embeddings.id })
        .from(embeddings)
        .where(
          and(
            eq(embeddings.sourceId, filingId),
            eq(embeddings.contentHash, job.contentHash),
          ),
        )
        .limit(1)

      if (existing.length > 0) return

      const embeddingText = buildEmbeddingText(job.chunk, job.section, ctx)
      const vector = await ai.generateEmbedding({ text: embeddingText })

      await db.insert(embeddings).values({
        sourceType: 'filing_summary',
        sourceId: filingId,
        contentHash: job.contentHash,
        embedding: vector,
        metadata: {
          section: job.section,
          filingId,
          chunkIndex: job.chunkIndex,
          totalChunks: job.totalChunks,
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
    },
    EMBEDDING_CONCURRENCY,
  )
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
