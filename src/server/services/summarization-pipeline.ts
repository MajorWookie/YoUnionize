/**
 * Summarisation pipeline — per-section grain.
 *
 * As of migration 20260429000000_per_section_summaries.sql, AI summaries
 * for individual SEC items live on `filing_sections` rows, while filing-
 * level rollups (executive_summary, employee_impact, structured XBRL) stay
 * on `filing_summaries.ai_summary`.
 *
 * Flow per filing:
 *   1. Load every filing_sections row for the filing.
 *   2. For each row, look up `getSectionDispatch(filingType, sectionCode)`.
 *   3. Apply the skip policy (fetch_status / text length / pass_through).
 *   4. Fan out Claude calls with bounded concurrency.
 *   5. Write each section's `ai_summary`, `summary_version`, `prompt_id`,
 *      `summarization_status`. Status is always `ai_generated` for fresh
 *      AI output; humans flip it later via the review CLI/UI.
 *   6. Compute filing-level rollups (executive_summary, employee_impact,
 *      XBRL statements) from the filing's raw_data + section text.
 *   7. Generate embeddings for both per-section summaries and rollup keys.
 *
 * Resumability: `summary_version IN (0, -1)` is the "needs work" sentinel
 * (0 = unprocessed, -1 = last attempt failed). Re-runs read directly from
 * the partial index `filing_sections_pending_summarize_idx`.
 */

import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import {
  getDb,
  companies,
  filingSummaries,
  filingSections,
  embeddings,
  executiveCompensation,
} from '@younionize/postgres'
import { CURRENT_SUMMARY_VERSION } from '@younionize/ai'
import type { ClaudeClient } from '@younionize/ai'
import { pMapSettled } from '@younionize/helpers'
import {
  getSectionDispatch,
  getSectionFriendlyName,
  PROMPT_VERSIONS,
  type SectionPromptKind,
} from '@younionize/sec-api'
import { getAiClient } from '../ai-client'
import { transformXbrlToStatements } from './xbrl-transformer'
import type { FinancialStatement } from './xbrl-transformer'

// ─── Concurrency limits ──────────────────────────────────────────────────────
// Tuned for Claude (50 RPM Tier-1) + Voyage (300 RPM). Per-filing serial
// keeps a single filing's logs coherent; section concurrency saturates the
// rate limit; embedding concurrency runs higher because Voyage is cheaper
// to parallelise.

const FILING_CONCURRENCY = 1
const SECTION_CONCURRENCY = 6
const EMBEDDING_CONCURRENCY = 10

// ─── Skip-policy result ─────────────────────────────────────────────────────

type SectionFetchStatus = 'success' | 'empty' | 'error'

interface SectionRow {
  id: string
  filingId: string
  sectionCode: string
  text: string | null
  fetchStatus: SectionFetchStatus
  summaryVersion: number
}

interface SectionWriteResult {
  rowId: string
  sectionCode: string
  status: 'ai_generated' | 'skipped'
  promptKind: SectionPromptKind
  promptId: string
  aiSummary: unknown
  summaryText: string | null // text used for embedding (null if skipped)
  inputTokens: number
  outputTokens: number
}

// ─── Public types ────────────────────────────────────────────────────────────

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
  summaryVersion: number
}

// Filing-level rollups that don't correspond to any single SEC item. Stored
// on filing_summaries.ai_summary, not on any filing_sections row.
const ROLLUP_KEYS = [
  'executive_summary',
  'employee_impact',
  'income_statement',
  'balance_sheet',
  'cash_flow',
  'shareholders_equity',
] as const
type RollupKey = (typeof ROLLUP_KEYS)[number]

// ─── Main pipeline ─────────────────────────────────────────────────────────

/**
 * Summarise all filings for a company that have outstanding work — either
 * unprocessed sections or an unprocessed filing-level rollup.
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

  // A filing needs work if its filing_summaries row is at summary_version 0/-1
  // OR any of its section rows is. We pick that up in one query by scanning
  // filings whose own version is unfinished.
  const filings = await db
    .select({
      id: filingSummaries.id,
      filingType: filingSummaries.filingType,
      accessionNumber: filingSummaries.accessionNumber,
      rawData: filingSummaries.rawData,
      summaryVersion: filingSummaries.summaryVersion,
    })
    .from(filingSummaries)
    .where(
      and(
        eq(filingSummaries.companyId, companyId),
        or(
          eq(filingSummaries.summaryVersion, 0),
          isNull(filingSummaries.aiSummary),
        ),
      ),
    )

  result.total = filings.length

  if (filings.length === 0) {
    console.info(`[Summarize] No filings need work for ${companyName}`)
    return result
  }

  console.info(
    `[Summarize] Processing ${filings.length} filings for ${companyName}`,
  )

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
  let inputTokens = 0
  let outputTokens = 0

  const sectionRows = await loadPendingSections(filing.id)

  console.info(
    `[Summarize] ${filing.filingType} ${filing.accessionNumber} — ` +
      `${sectionRows.length} sections pending`,
  )

  // ── Per-section fan-out ─────────────────────────────────────────────────
  const sectionResults = await pMapSettled(
    sectionRows,
    (row) => processSection(row, filing, companyName, ai),
    SECTION_CONCURRENCY,
  )

  const sectionMapByCode = new Map<string, string>(
    sectionRows
      .filter((r): r is SectionRow & { text: string } => r.text != null && r.fetchStatus === 'success')
      .map((r) => [r.sectionCode, r.text]),
  )

  // ── Persist per-section results ─────────────────────────────────────────
  const successfulWrites: Array<SectionWriteResult> = []
  for (let i = 0; i < sectionRows.length; i++) {
    const row = sectionRows[i]
    const entry = sectionResults[i]

    if (entry.status === 'fulfilled') {
      const write = entry.value
      await persistSectionResult(write)
      successfulWrites.push(write)
      inputTokens += write.inputTokens
      outputTokens += write.outputTokens
    } else {
      const errMsg = entry.reason instanceof Error ? entry.reason.message : String(entry.reason)
      console.info(
        `[Summarize] Section ${row.sectionCode} failed — ${errMsg}`,
      )
      await markSectionFailed(row.id)
    }
  }

  // ── Filing-level rollups ────────────────────────────────────────────────
  const rollupSummary: Record<string, unknown> = {}
  const rollupUsage = await buildRollups(
    filing,
    companyId,
    companyName,
    sectionMapByCode,
    successfulWrites,
    rollupSummary,
    ai,
  )
  inputTokens += rollupUsage.inputTokens
  outputTokens += rollupUsage.outputTokens

  // ── Persist filing-level state ─────────────────────────────────────────
  await db
    .update(filingSummaries)
    .set({
      aiSummary: rollupSummary,
      summaryVersion: CURRENT_SUMMARY_VERSION,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(filingSummaries.id, filing.id))

  // ── Embeddings (per-section + rollup) ──────────────────────────────────
  const embeddingCtx = await getEmbeddingContext(companyId, filing)
  await generateAllEmbeddings(filing.id, successfulWrites, rollupSummary, ai, embeddingCtx).catch((err) => {
    console.info(
      `[Summarize] Embedding generation failed for ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`,
    )
  })

  return { inputTokens, outputTokens }
}

// ─── Section loading ────────────────────────────────────────────────────────

async function loadPendingSections(filingId: string): Promise<Array<SectionRow>> {
  const db = getDb()
  const rows = await db
    .select({
      id: filingSections.id,
      filingId: filingSections.filingId,
      sectionCode: filingSections.sectionCode,
      text: filingSections.text,
      fetchStatus: filingSections.fetchStatus,
      summaryVersion: filingSections.summaryVersion,
    })
    .from(filingSections)
    .where(
      and(
        eq(filingSections.filingId, filingId),
        inArray(filingSections.summaryVersion, [0, -1]),
      ),
    )

  return rows.map((r) => ({
    id: r.id,
    filingId: r.filingId,
    sectionCode: r.sectionCode,
    text: r.text,
    fetchStatus: r.fetchStatus as SectionFetchStatus,
    summaryVersion: r.summaryVersion,
  }))
}

// ─── Section processing (dispatch + skip policy) ────────────────────────────

async function processSection(
  row: SectionRow,
  filing: FilingRow,
  companyName: string,
  ai: ClaudeClient,
): Promise<SectionWriteResult> {
  const dispatch = getSectionDispatch(filing.filingType, row.sectionCode)

  // Skip policy — applied uniformly before any Claude call.
  const text = row.text ?? ''
  const skip =
    dispatch.promptKind === 'pass_through' ||
    (dispatch.skipIfEmpty && row.fetchStatus !== 'success') ||
    text.length < dispatch.minLength

  if (skip) {
    return {
      rowId: row.id,
      sectionCode: row.sectionCode,
      status: 'skipped',
      promptKind: dispatch.promptKind,
      promptId: PROMPT_VERSIONS[dispatch.promptKind],
      aiSummary: null,
      summaryText: null,
      inputTokens: 0,
      outputTokens: 0,
    }
  }

  // Dispatch by prompt kind.
  const dispatchResult = await callPromptForSection({
    promptKind: dispatch.promptKind,
    sectionCode: row.sectionCode,
    sectionText: text,
    filingType: filing.filingType,
    companyName,
    ai,
  })

  return {
    rowId: row.id,
    sectionCode: row.sectionCode,
    status: 'ai_generated',
    promptKind: dispatch.promptKind,
    promptId: PROMPT_VERSIONS[dispatch.promptKind],
    aiSummary: dispatchResult.data,
    summaryText: dispatchResult.summaryText,
    inputTokens: dispatchResult.usage.inputTokens,
    outputTokens: dispatchResult.usage.outputTokens,
  }
}

interface DispatchCallResult {
  data: unknown
  summaryText: string | null
  usage: { inputTokens: number; outputTokens: number }
}

async function callPromptForSection(args: {
  promptKind: SectionPromptKind
  sectionCode: string
  sectionText: string
  filingType: string
  companyName: string
  ai: ClaudeClient
}): Promise<DispatchCallResult> {
  const { promptKind, sectionCode, sectionText, filingType, companyName, ai } = args

  switch (promptKind) {
    case 'mda': {
      const r = await ai.summarizeMda({ mdaText: sectionText, companyName, filingType })
      return { data: r.data, summaryText: r.data, usage: r.usage }
    }
    case 'risk_factors':
    case 'business_overview':
    case 'legal_proceedings':
    case 'executive_compensation':
    case 'financial_footnotes':
    case 'cybersecurity':
    case 'controls_and_procedures':
    case 'related_transactions':
    case 'proxy':
    case 'narrative': {
      const r = await ai.summarizeSection({
        section: sectionText,
        sectionType: PROMPT_KIND_TO_PROMPT_LABEL[promptKind],
        companyName,
        filingType,
      })
      return { data: r.data, summaryText: r.data, usage: r.usage }
    }
    case 'event_8k': {
      const r = await ai.summarizeSection({
        section: `${getSectionFriendlyName(sectionCode, filingType)}:\n${sectionText}`,
        sectionType: 'event_summary',
        companyName,
        filingType,
      })
      return { data: r.data, summaryText: r.data, usage: r.usage }
    }
    // Rollup / XBRL / pass_through don't appear here — they're handled
    // outside processSection. Falling into this branch is a programmer bug.
    default:
      throw new Error(`Unsupported prompt kind in section dispatch: ${promptKind}`)
  }
}

/**
 * The Claude prompts in `packages/ai/src/prompts/section-summary.ts` key
 * their guidance off camelCase labels. This map is the single bridge
 * between the new dispatch kinds and that prompt-template contract.
 *
 * When a specialised prompt template lands (e.g. cybersecurity@v1 with its
 * own system prompt), its label here can change to match the new prompt
 * file without touching the pipeline.
 */
const PROMPT_KIND_TO_PROMPT_LABEL: Record<SectionPromptKind, string> = {
  rollup_executive_summary: 'rollup_executive_summary',
  rollup_employee_impact: 'rollup_employee_impact',
  xbrl_income_statement: 'xbrl_income_statement',
  xbrl_balance_sheet: 'xbrl_balance_sheet',
  xbrl_cash_flow: 'xbrl_cash_flow',
  xbrl_shareholders_equity: 'xbrl_shareholders_equity',
  mda: 'mdAndA',
  risk_factors: 'riskFactors',
  business_overview: 'businessOverview',
  legal_proceedings: 'legalProceedings',
  executive_compensation: 'executiveCompensation',
  financial_footnotes: 'financialStatements',
  // Until specialised prompts ship in a follow-up branch, these route
  // through the generic narrative path. See packages/sec-api/src/section-prompts.ts.
  cybersecurity: 'cybersecurity',
  controls_and_procedures: 'controlsAndProcedures',
  related_transactions: 'relatedTransactions',
  proxy: 'proxy',
  event_8k: 'event_summary',
  narrative: 'narrative',
  pass_through: 'pass_through',
}

// ─── Section persistence ────────────────────────────────────────────────────

async function persistSectionResult(write: SectionWriteResult): Promise<void> {
  const db = getDb()
  await db
    .update(filingSections)
    .set({
      aiSummary: write.aiSummary as Record<string, unknown> | null,
      summarizationStatus: write.status,
      summaryVersion: CURRENT_SUMMARY_VERSION,
      promptId: write.promptId,
      summarizationUpdatedAt: new Date().toISOString(),
    })
    .where(eq(filingSections.id, write.rowId))
}

async function markSectionFailed(rowId: string): Promise<void> {
  const db = getDb()
  await db
    .update(filingSections)
    .set({
      summaryVersion: -1,
      summarizationUpdatedAt: new Date().toISOString(),
    })
    .where(eq(filingSections.id, rowId))
}

// ─── Filing-level rollups ───────────────────────────────────────────────────

async function buildRollups(
  filing: FilingRow,
  companyId: string,
  companyName: string,
  sectionMapByCode: Map<string, string>,
  sectionWrites: ReadonlyArray<SectionWriteResult>,
  rollupOut: Record<string, unknown>,
  ai: ClaudeClient,
): Promise<{ inputTokens: number; outputTokens: number }> {
  let inputTokens = 0
  let outputTokens = 0

  // Structured XBRL — no Claude call; pure transformation.
  const xbrlData = filing.rawData.xbrlData as Record<string, unknown> | undefined
  if (xbrlData) {
    const statements = transformXbrlToStatements(xbrlData)
    for (const key of ['income_statement', 'balance_sheet', 'cash_flow', 'shareholders_equity'] as const) {
      if (statements[key]) {
        rollupOut[key] = statements[key]
      }
    }
  }

  // Executive summary (10-K, 10-Q only — 8-K and DEF 14A don't carry the
  // breadth of context this prompt expects).
  if (filing.filingType === '10-K' || filing.filingType === '10-Q') {
    try {
      const summary = await ai.generateCompanySummary({
        rawData: filing.rawData,
        filingType: filing.filingType,
        companyName,
      })
      rollupOut.executive_summary = summary.data
      inputTokens += summary.usage.inputTokens
      outputTokens += summary.usage.outputTokens
    } catch (err) {
      console.info(
        `[Summarize] executive_summary rollup failed for ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    // Employee impact — also 10-K/10-Q. Pulls in risk_factors + mda text.
    try {
      const riskCode = filing.filingType === '10-K' ? '1A' : 'part2item1a'
      const mdaCode = filing.filingType === '10-K' ? '7' : 'part1item2'
      const impact = await ai.generateEmployeeImpact({
        rawData: filing.rawData,
        filingType: filing.filingType,
        companyName,
        riskFactors: sectionMapByCode.get(riskCode),
        mdaText: sectionMapByCode.get(mdaCode),
      })
      rollupOut.employee_impact = impact.data
      inputTokens += impact.usage.inputTokens
      outputTokens += impact.usage.outputTokens
    } catch (err) {
      console.info(
        `[Summarize] employee_impact rollup failed for ${filing.accessionNumber}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // Executive compensation rollup — top-5 + analysis. Lives on the DEF 14A
  // summary only; 10-K Item 11 is incorporated-by-reference boilerplate and
  // produces no usable analysis. The frontend reads this from proxySummary.
  if (filing.filingType === 'DEF 14A') {
    const execComp = await buildExecCompRollup(companyId, companyName, sectionMapByCode, ai)
    rollupOut.executive_compensation = execComp.result
    inputTokens += execComp.usage.inputTokens
    outputTokens += execComp.usage.outputTokens
  }

  // 8-K rollup — combine the per-section event_8k summaries into a single
  // markdown narrative on rollupOut.event_summary. The dashboard's Recent
  // Events card reads this exact key from filing_summaries.ai_summary; without
  // it, the row appears summarized (ai_summary != null) but renders blank.
  if (filing.filingType === '8-K') {
    const aggregated = aggregate8KEvents(sectionWrites, filing.filingType)
    if (aggregated) rollupOut.event_summary = aggregated
  }

  return { inputTokens, outputTokens }
}

/**
 * Combine all per-section event_8k summaries for one 8-K filing into a single
 * markdown string. Each item gets its friendly heading (e.g. "Item 5.02
 * Departure of Directors") followed by the AI summary. Returns null when no
 * event_8k sections were produced (e.g. all items skipped or pass_through).
 */
function aggregate8KEvents(
  sectionWrites: ReadonlyArray<SectionWriteResult>,
  filingType: string,
): string | null {
  const events = sectionWrites.filter(
    (w): w is SectionWriteResult & { summaryText: string } =>
      w.promptKind === 'event_8k' && typeof w.summaryText === 'string' && w.summaryText.trim().length > 0,
  )
  if (events.length === 0) return null

  return events
    .map((w) => `### ${getSectionFriendlyName(w.sectionCode, filingType)}\n\n${w.summaryText.trim()}`)
    .join('\n\n---\n\n')
}

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

async function buildExecCompRollup(
  companyId: string,
  companyName: string,
  sectionMapByCode: Map<string, string>,
  ai: ClaudeClient,
): Promise<{ result: ExecCompSummary; usage: { inputTokens: number; outputTokens: number } }> {
  const db = getDb()
  const usage = { inputTokens: 0, outputTokens: 0 }

  const compData = await db
    .select()
    .from(executiveCompensation)
    .where(eq(executiveCompensation.companyId, companyId))
    .orderBy(executiveCompensation.totalCompensation)
    .limit(20)

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

  const ceoPayRatio =
    compData.find((e) => e.ceoPayRatio != null)?.ceoPayRatio ?? null

  // DEF 14A doesn't carry risk-factors itself. The 10-K's risk-factors
  // signal isn't in scope here — leave the field present (UI consumers
  // tolerate false) and let a future cross-filing rollup own that flag.
  const employeeCompAsRiskFactor = false

  // DEF 14A's detailed exec-comp item lives at part1item7 (CD&A) or
  // part1item1 (proxy intro), depending on how the filer structured it.
  const proxyText =
    sectionMapByCode.get('part1item7') ??
    sectionMapByCode.get('part1item1') ??
    null

  let analysis: string | null = null
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

// ─── Embedding generation ───────────────────────────────────────────────────

interface EmbeddingContext {
  companyId: string
  companyTicker: string
  filingType: string
  periodEnd: string | null
}

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

const SECTION_LABELS: Record<string, string> = {
  executive_summary: 'Company overview and key takeaways',
  employee_impact: 'Impact on employees',
  income_statement: 'Income statement financial data',
  balance_sheet: 'Balance sheet financial data',
  cash_flow: 'Cash flow statement',
  shareholders_equity: 'Shareholders equity statement',
  executive_compensation: 'Executive compensation analysis',
}

function buildSectionEmbeddingLabel(
  sectionCode: string,
  filingType: string,
  promptKind: SectionPromptKind,
): string {
  const friendly = getSectionFriendlyName(sectionCode, filingType)
  return `${promptKind} (${friendly})`
}

function buildEmbeddingText(
  chunk: string,
  label: string,
  ctx: EmbeddingContext | undefined,
): string {
  const prefix = ctx
    ? `[${ctx.companyTicker} ${ctx.filingType} | ${label}${ctx.periodEnd ? ` | Period: ${ctx.periodEnd}` : ''}]`
    : `[${label}]`
  return `${prefix}\n${chunk}`
}

interface ChunkJob {
  filingId: string
  sectionCode: string | null // null for filing-level rollups
  promptKind: SectionPromptKind | RollupKey
  chunk: string
  contentHash: string
  chunkIndex: number
  totalChunks: number
  label: string
}

async function generateAllEmbeddings(
  filingId: string,
  sectionWrites: Array<SectionWriteResult>,
  rollupSummary: Record<string, unknown>,
  ai: ClaudeClient,
  ctx: EmbeddingContext,
): Promise<void> {
  const db = getDb()
  const jobs: Array<ChunkJob> = []

  // Per-section jobs: only summaries with extractable text.
  for (const write of sectionWrites) {
    if (write.status === 'skipped' || !write.summaryText) continue
    if (write.summaryText.trim().length < 50) continue

    const label = buildSectionEmbeddingLabel(write.sectionCode, ctx.filingType, write.promptKind)
    const chunks = chunkText(write.summaryText)
    for (let i = 0; i < chunks.length; i++) {
      jobs.push({
        filingId,
        sectionCode: write.sectionCode,
        promptKind: write.promptKind,
        chunk: chunks[i],
        contentHash: createHash('sha256').update(chunks[i]).digest('hex'),
        chunkIndex: i,
        totalChunks: chunks.length,
        label,
      })
    }
  }

  // Rollup jobs (filing_summaries.ai_summary keys).
  for (const key of ROLLUP_KEYS) {
    const text = extractRollupText(key, rollupSummary[key])
    if (!text || text.trim().length < 50) continue

    const label = SECTION_LABELS[key] ?? key
    const chunks = chunkText(text)
    for (let i = 0; i < chunks.length; i++) {
      jobs.push({
        filingId,
        sectionCode: null,
        promptKind: key,
        chunk: chunks[i],
        contentHash: createHash('sha256').update(chunks[i]).digest('hex'),
        chunkIndex: i,
        totalChunks: chunks.length,
        label,
      })
    }
  }

  // Executive-compensation rollup (special case — its `analysis` field
  // carries the narrative; top5/ratio are structured numbers we don't embed).
  const execComp = rollupSummary.executive_compensation as ExecCompSummary | undefined
  if (execComp?.analysis && execComp.analysis.trim().length >= 50) {
    const chunks = chunkText(execComp.analysis)
    for (let i = 0; i < chunks.length; i++) {
      jobs.push({
        filingId,
        sectionCode: null,
        promptKind: 'executive_compensation',
        chunk: chunks[i],
        contentHash: createHash('sha256').update(chunks[i]).digest('hex'),
        chunkIndex: i,
        totalChunks: chunks.length,
        label: SECTION_LABELS.executive_compensation,
      })
    }
  }

  if (jobs.length === 0) return

  await pMapSettled(
    jobs,
    async (job) => {
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

      const embeddingText = buildEmbeddingText(job.chunk, job.label, ctx)
      const vector = await ai.generateEmbedding({ text: embeddingText })

      await db.insert(embeddings).values({
        sourceType: 'filing_summary',
        sourceId: filingId,
        contentHash: job.contentHash,
        embedding: vector,
        metadata: {
          section: job.promptKind,
          sectionCode: job.sectionCode,
          filingId,
          chunkIndex: job.chunkIndex,
          totalChunks: job.totalChunks,
          companyId: ctx.companyId,
          companyTicker: ctx.companyTicker,
          filingType: ctx.filingType,
          periodEnd: ctx.periodEnd,
        },
      })
    },
    EMBEDDING_CONCURRENCY,
  )
}

function extractRollupText(key: RollupKey, value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value

  // CompanySummaryResult (executive_summary)
  if (key === 'executive_summary' && typeof value === 'object' && 'headline' in (value as Record<string, unknown>)) {
    const v = value as Record<string, unknown>
    return [v.headline, v.company_health].filter(Boolean).join('\n\n')
  }
  // EmployeeImpactResult
  if (key === 'employee_impact' && typeof value === 'object' && 'overall_outlook' in (value as Record<string, unknown>)) {
    const v = value as Record<string, unknown>
    return [
      v.overall_outlook,
      v.job_security,
      v.compensation_signals,
      v.growth_opportunities,
      v.workforce_geography,
      v.h1b_and_visa_dependency,
    ].filter(Boolean).join('\n\n')
  }
  // FinancialStatement (XBRL)
  if (typeof value === 'object' && 'items' in (value as Record<string, unknown>)) {
    const stmt = value as FinancialStatement
    if (!stmt.items) return null
    return `${stmt.title}: ` +
      stmt.items
        .filter((item) => item.current != null)
        .map(
          (item) =>
            `${item.label}: ${formatNumber(item.current)}` +
            (item.changePercent != null
              ? ` (${item.changePercent > 0 ? '+' : ''}${item.changePercent}%)`
              : ''),
        )
        .join(', ')
  }
  return null
}

function formatNumber(value: number | null): string {
  if (value == null) return 'N/A'
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(2)}`
}

// ─── Text chunking ──────────────────────────────────────────────────────────

const TARGET_CHUNK_TOKENS = 400
const MAX_CHUNK_TOKENS = 600
const CHARS_PER_TOKEN = 4

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

    if (paraLen > maxChars) {
      if (currentParts.length > 0) {
        chunks.push(currentParts.join('\n\n').trim())
        currentParts = []
        currentLen = 0
      }
      chunks.push(...splitBySentences(para, targetChars, maxChars))
      continue
    }

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

  const summarized = filings.filter((f) => f.aiSummary != null && f.summaryVersion === CURRENT_SUMMARY_VERSION).length

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
