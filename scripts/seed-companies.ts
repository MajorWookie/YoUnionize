/**
 * Seed script: preload SEC financial data for a list of companies.
 *
 * For each ticker:
 *   1. Resolve ticker → CIK via SEC API, upsert into companies table
 *   2. Ingest 5 10-Ks, 5 DEF 14As, 1 year of 8-Ks (no 10-Qs)
 *   3. Ingest exec compensation, insider trades, directors
 *   4. Run AI summarization (Claude) + embedding generation (OpenAI)
 *
 * Usage:
 *   bun run scripts/seed-companies.ts
 *   bun run scripts/seed-companies.ts --skip-summarization
 *   bun run scripts/seed-companies.ts --tickers=AAPL,MSFT,GOOGL
 *   bun run scripts/seed-companies.ts --tickers=AAPL --years=3
 *   bun run scripts/seed-companies.ts --years=2              # 2 10-Ks, 2 DEF 14As, 24mo 8-Ks
 *   bun run scripts/seed-companies.ts --tickers=ORCL --retry # replay rows in fetch_status='error'
 *
 * Requires:
 *   - .env with SEC_API_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY, DATABASE_URL
 *   - Local Supabase running (supabase start)
 */

import { eq } from 'drizzle-orm'
import { getDb, filingSummaries, filingSections } from '@younionize/postgres'
import { pMapSettled } from '@younionize/helpers'
import { getSecApiClient } from '../src/server/sec-api-client'
import { lookupCompany } from '../src/server/services/company-lookup'
import { ingestCompensation } from '../src/server/services/compensation-ingestion'
import { ingestInsiderTrading } from '../src/server/services/insider-trading-ingestion'
import { ingestDirectors } from '../src/server/services/directors-ingestion'
import { summarizeCompanyFilings } from '../src/server/services/summarization-pipeline'
import {
  retryFailedFilingSections,
  retryFailedRawResponses,
} from '../src/server/services/sec-retry'
import type { CompanyRecord } from '../src/server/services/company-lookup'
import type { Filing } from '@younionize/sec-api'
import { getActualSectionItems } from '@younionize/sec-api'

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_TICKERS = [
  'NVDA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'TSLA', 'JPM', 'AVGO',
  'WMT', 'UPS', 'TGT', 'HD', 'KR', 'FDX', 'CVS', 'LOW', 'SBUX', 'MCD',
  'NFLX', 'NKE', 'KO', 'DIS', 'UNH', 'XOM',
  'LAMR', 'ORCL', 'FFIV', 'SNX', 'CDW',
]

const SEED_CONFIG: {
  tenKCount: number
  defCount: number
  eightKMonths: number
  companyConcurrency: number
} = {
  tenKCount: 5,
  defCount: 5,
  eightKMonths: 12,
  /** How many companies to process in parallel */
  companyConcurrency: 2,
}

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const skipSummarization = args.includes('--skip-summarization')
// --retry: skip the full ingest path, only re-run sec-retry + processing +
// summarization for filings already in the DB. Useful after a first-pass
// run leaves rows in fetch_status='error' (e.g. sec-api's async extractor
// timed out under load — see PROCESSING_MAX_POLLS in @younionize/sec-api).
const retryMode = args.includes('--retry')
const tickersFlag = args.find((a) => a.startsWith('--tickers='))
const yearsFlag = args.find((a) => a.startsWith('--years='))
const tickers = tickersFlag
  ? tickersFlag.split('=')[1].split(',').map((t) => t.trim().toUpperCase())
  : DEFAULT_TICKERS

if (yearsFlag) {
  const years = Number(yearsFlag.split('=')[1])
  if (Number.isNaN(years) || years < 1) {
    console.error('[Seed] --years must be a positive integer')
    process.exit(1)
  }
  SEED_CONFIG.tenKCount = years
  SEED_CONFIG.defCount = years
  SEED_CONFIG.eightKMonths = years * 12
}

// ─── Seed filing ingestion (uses CIK, custom counts) ────────────────────────

async function ingestFilingsForSeed(company: CompanyRecord): Promise<{
  ingested: number
  skipped: number
  errors: Array<string>
}> {
  const client = getSecApiClient()
  const db = getDb()
  const result = { ingested: 0, skipped: 0, errors: [] as Array<string> }

  const eightKCutoff = new Date()
  eightKCutoff.setMonth(eightKCutoff.getMonth() - SEED_CONFIG.eightKMonths)
  const eightKCutoffStr = eightKCutoff.toISOString().split('T')[0]

  // Use CIK for reliable queries
  const cikQuery = `cik:${company.cik}`

  console.info(`[Seed] Fetching filings for ${company.ticker} (CIK: ${company.cik})`)

  // Fetch all filing types in parallel
  const [tenKResult, defResult, eightKResult] = await Promise.all([
    client.searchFilings({
      query: `${cikQuery} AND formType:"10-K"`,
      from: '0',
      size: String(SEED_CONFIG.tenKCount),
      sort: [{ filedAt: { order: 'desc' } }],
    }),
    client.searchFilings({
      query: `${cikQuery} AND formType:"DEF 14A"`,
      from: '0',
      size: String(SEED_CONFIG.defCount),
      sort: [{ filedAt: { order: 'desc' } }],
    }),
    client.searchFilings({
      query: `${cikQuery} AND formType:"8-K" AND filedAt:[${eightKCutoffStr} TO *]`,
      from: '0',
      size: '50',
      sort: [{ filedAt: { order: 'desc' } }],
    }),
  ])

  const allFilings = [
    ...tenKResult.filings.map((f) => ({ filing: f, filingType: '10-K' })),
    ...defResult.filings.map((f) => ({ filing: f, filingType: 'DEF 14A' })),
    ...eightKResult.filings.map((f) => ({ filing: f, filingType: '8-K' })),
  ]

  console.info(
    `[Seed]   Found: ${tenKResult.filings.length} 10-Ks, ${defResult.filings.length} DEF 14As, ${eightKResult.filings.length} 8-Ks`,
  )

  for (const { filing, filingType } of allFilings) {
    try {
      // Check for existing record (idempotency)
      const existing = await db
        .select({ id: filingSummaries.id })
        .from(filingSummaries)
        .where(eq(filingSummaries.accessionNumber, filing.accessionNo))
        .limit(1)

      if (existing.length > 0) {
        result.skipped++
        continue
      }

      // Build raw_data (filing metadata + optional XBRL).
      // Section text now lives in the filing_sections table, populated below.
      const rawData: Record<string, unknown> = { ...filing }

      if (filingType === '10-K' && filing.linkToFilingDetails) {
        const xbrl = await safeXbrl(filing)
        if (xbrl) rawData.xbrlData = xbrl
      }

      const [inserted] = await db
        .insert(filingSummaries)
        .values({
          companyId: company.id,
          filingType,
          periodEnd: filing.periodOfReport ?? null,
          filedAt: filing.filedAt,
          accessionNumber: filing.accessionNo,
          rawData,
          aiSummary: null,
        })
        .returning({ id: filingSummaries.id })

      if (filing.linkToFilingDetails) {
        await extractSectionsToTable(filing, filingType, inserted.id)
      }

      result.ingested++
      console.info(`[Seed]   ✓ ${filingType} ${filing.periodOfReport ?? filing.filedAt} (${filing.accessionNo})`)
    } catch (err) {
      const msg = `${filingType} ${filing.accessionNo}: ${err instanceof Error ? err.message : String(err)}`
      console.info(`[Seed]   ✗ ${msg}`)
      result.errors.push(msg)
    }
  }

  return result
}

async function safeXbrl(filing: Filing): Promise<unknown | null> {
  const client = getSecApiClient()
  try {
    if (filing.linkToFilingDetails) {
      return await client.xbrlToJson({ htmUrl: filing.linkToFilingDetails })
    }
    if (filing.accessionNo) {
      return await client.xbrlToJson({ accessionNo: filing.accessionNo })
    }
    return null
  } catch {
    console.info(`[Seed]   XBRL extraction failed for ${filing.accessionNo}`)
    return null
  }
}

// Cap how many sec-api extractor calls run in parallel per filing. The
// extractor is async on sec-api's side (it returns "processing" until ready)
// and gets overwhelmed when 17-21 sections fire at once across multiple
// filings — leading to a flood of timed-out polls. 4 concurrent calls per
// filing keeps the upstream queue happy without crawling.
const SECTION_EXTRACT_CONCURRENCY = 4

async function extractSectionsToTable(
  filing: Filing,
  filingType: string,
  filingId: string,
): Promise<void> {
  const client = getSecApiClient()
  const db = getDb()
  const url = filing.linkToFilingDetails
  if (!url) return

  // For 8-K, only ask sec-api about items actually in the filing. The
  // unfiltered list would burn ~60s per non-existent item polling for a
  // "processing" placeholder that never resolves. See getActualSectionItems
  // in @younionize/sec-api.
  const rawItems = (filing as unknown as { items?: ReadonlyArray<string> }).items
  const sectionItems = getActualSectionItems(filingType, rawItems)
  if (sectionItems.length === 0) return

  const results = await pMapSettled(
    sectionItems,
    async (item) => {
      const text = await client.extractSection(url, item.code)
      return { item, text }
    },
    SECTION_EXTRACT_CONCURRENCY,
  )

  for (let i = 0; i < results.length; i++) {
    const item = sectionItems[i]
    const settled = results[i]

    let fetchStatus: 'success' | 'empty' | 'error'
    let text: string | null
    let fetchError: string | null = null

    if (settled.status === 'rejected') {
      fetchStatus = 'error'
      text = null
      fetchError = settled.reason instanceof Error ? settled.reason.message : String(settled.reason)
    } else if (!settled.value.text || settled.value.text.length === 0) {
      fetchStatus = 'empty'
      text = null
    } else {
      fetchStatus = 'success'
      text = settled.value.text
    }

    await db
      .insert(filingSections)
      .values({
        filingId,
        sectionCode: item.code,
        text,
        fetchStatus,
        fetchError,
      })
      .onConflictDoUpdate({
        target: [filingSections.filingId, filingSections.sectionCode],
        set: { text, fetchStatus, fetchError, extractedAt: new Date().toISOString() },
      })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
  return `${remainingSeconds}s`
}

// ─── Per-company pipeline ─────────────────────────────────────────────────

interface CompanyResult {
  ticker: string
  success: boolean
  duration: number
  filings: { ingested: number; skipped: number }
  error?: string
}

async function seedCompany(ticker: string, index: number, total: number): Promise<CompanyResult> {
  const companyStart = Date.now()

  console.info(`[Seed] ─── ${ticker} (${index + 1}/${total}) ─────────────────────────`)

  // Heartbeat every 10s so the script never goes silent during long phases
  // (section extraction, summarization, retry). `phase` is mutated as the
  // pipeline progresses; each tick reports where we currently are. The
  // try/finally guarantees clearInterval on every exit path — success,
  // error, or early return — so we don't leak timers when companies run in
  // parallel.
  let phase = 'startup'
  const heartbeat = setInterval(() => {
    const elapsedSec = Math.round((Date.now() - companyStart) / 1000)
    console.info(`[Seed] [${ticker}] ♥ ${phase} — ${elapsedSec}s elapsed`)
  }, 10_000)

  try {
    try {
      // 1. Look up company (resolve ticker → CIK, upsert DB)
      phase = 'company lookup'
      const company = await lookupCompany(ticker)
      console.info(`[Seed] Company: ${company.name} (CIK: ${company.cik})`)

      // ── Retry mode ─────────────────────────────────────────────────────
      // Skip the cold-start ingest path. Replay raw_sec_responses rows that
      // ended in fetch_status='error' (sec-api timeouts, 429s, "processing"
      // placeholders that exceeded the polling budget) by handing off to
      // retryFailedRawResponses, then re-summarise.
      if (retryMode) {
        console.info(`[Seed] [${ticker}] Retry mode — replaying error rows…`)

        // Two retry paths because the project has two ingest paths:
        //   • retryFailedRawResponses replays raw_sec_responses errors (the
        //     production Edge Function ingest path). No-op for seed-only data
        //     since the seed bypasses raw_sec_responses.
        //   • retryFailedFilingSections replays filing_sections errors (the
        //     seed's direct-write path). This is what actually drains the
        //     830 8-K errors from a seeded DB.
        phase = 'raw_sec_responses retry'
        console.info(`[Seed] [${ticker}] Phase 1/3: raw_sec_responses retry…`)
        const retry = await retryFailedRawResponses(company)
        if (retry.fetchErrorsBefore > 0 || retry.processFailuresBefore > 0) {
          console.info(
            `[Seed] [${ticker}] Raw retry: ${retry.fetchErrorsBefore}→${retry.fetchErrorsAfter} fetch errors, ` +
              `${retry.processFailuresBefore}→${retry.processFailuresAfter} process failures`,
          )
        } else {
          console.info(`[Seed] [${ticker}] (no raw_sec_responses errors)`)
        }

        phase = 'filing_sections retry'
        console.info(`[Seed] [${ticker}] Phase 2/3: filing_sections retry…`)
        const sectionRetry = await retryFailedFilingSections(company)
        if (sectionRetry.errorsBefore > 0) {
          console.info(
            `[Seed] [${ticker}] Section retry: ${sectionRetry.errorsBefore}→${sectionRetry.errorsAfter} errors ` +
              `(${sectionRetry.recovered} recovered)`,
          )
        } else {
          console.info(`[Seed] [${ticker}] No section errors to replay`)
        }

        if (!skipSummarization) {
          phase = 'summarization (retry)'
          console.info(`[Seed] [${ticker}] Phase 3/3: summarizing filings (retry pass)…`)
          const summaryResult = await summarizeCompanyFilings(company.id, company.name)
          console.info(
            `[Seed] [${ticker}] Summarized: ${summaryResult.summarized}/${summaryResult.total} ` +
              `(${summaryResult.tokenUsage.inputTokens} in / ${summaryResult.tokenUsage.outputTokens} out tokens)`,
          )
        }

        const duration = Date.now() - companyStart
        console.info(`[Seed] ✓ ${ticker} retry complete (${formatDuration(duration)})`)
        return {
          ticker,
          success: retry.fetchErrorsAfter === 0 && sectionRetry.errorsAfter === 0,
          duration,
          filings: { ingested: 0, skipped: 0 },
        }
      }

      // 2. Run ingestion pipelines in parallel
      phase = 'ingest filings/comp/trades/directors'
      const [filingResult, compResult, tradeResult, dirResult] = await Promise.allSettled([
        ingestFilingsForSeed(company),
        ingestCompensation(company),
        ingestInsiderTrading(company),
        ingestDirectors(company, { filingCount: SEED_CONFIG.defCount }),
      ])

      const filingsData = filingResult.status === 'fulfilled' ? filingResult.value : null
      const compData = compResult.status === 'fulfilled' ? compResult.value : null
      const tradeData = tradeResult.status === 'fulfilled' ? tradeResult.value : null
      const dirData = dirResult.status === 'fulfilled' ? dirResult.value : null

      console.info(`[Seed] [${ticker}] Filings:  ${filingsData ? `${filingsData.ingested} ingested, ${filingsData.skipped} skipped` : `FAILED: ${(filingResult as PromiseRejectedResult).reason?.message}`}`)
      console.info(`[Seed] [${ticker}] Exec comp: ${compData ? `${compData.ingested} ingested, ${compData.skipped} skipped` : `FAILED: ${(compResult as PromiseRejectedResult).reason?.message}`}`)
      console.info(`[Seed] [${ticker}] Trades:   ${tradeData ? `${tradeData.ingested} ingested, ${tradeData.skipped} skipped` : `FAILED: ${(tradeResult as PromiseRejectedResult).reason?.message}`}`)
      console.info(`[Seed] [${ticker}] Directors: ${dirData ? `${dirData.ingested} ingested, ${dirData.skipped} skipped` : `FAILED: ${(dirResult as PromiseRejectedResult).reason?.message}`}`)

      const allErrors = [
        ...(filingsData?.errors ?? []),
        ...(compData?.errors ?? []),
        ...(tradeData?.errors ?? []),
        ...(dirData?.errors ?? []),
      ]
      if (allErrors.length > 0) {
        console.info(`[Seed] [${ticker}] Warnings: ${allErrors.length} non-fatal errors`)
        for (const err of allErrors.slice(0, 5)) {
          console.info(`[Seed] [${ticker}]   - ${err}`)
        }
        if (allErrors.length > 5) {
          console.info(`[Seed] [${ticker}]   ... and ${allErrors.length - 5} more`)
        }
      }

      // 3. Run AI summarization + embeddings
      if (!skipSummarization) {
        phase = 'summarization'
        console.info(`[Seed] [${ticker}] Summarizing filings...`)
        const summaryResult = await summarizeCompanyFilings(company.id, company.name)
        console.info(
          `[Seed] [${ticker}] Summarized: ${summaryResult.summarized}/${summaryResult.total} ` +
          `(${summaryResult.tokenUsage.inputTokens} in / ${summaryResult.tokenUsage.outputTokens} out tokens)`,
        )
        if (summaryResult.errors.length > 0) {
          console.info(`[Seed] [${ticker}] Summary errors: ${summaryResult.errors.length}`)
        }
      }

      const duration = Date.now() - companyStart
      console.info(`[Seed] ✓ ${ticker} complete (${formatDuration(duration)})`)

      return {
        ticker,
        success: true,
        duration,
        filings: {
          ingested: filingsData?.ingested ?? 0,
          skipped: filingsData?.skipped ?? 0,
        },
      }
    } catch (err) {
      const duration = Date.now() - companyStart
      const msg = err instanceof Error ? err.message : String(err)
      console.info(`[Seed] ✗ ${ticker} FAILED in phase '${phase}': ${msg}`)
      return {
        ticker,
        success: false,
        duration,
        filings: { ingested: 0, skipped: 0 },
        error: msg,
      }
    }
  } finally {
    clearInterval(heartbeat)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Validate environment
  const requiredEnvVars = ['SEC_API_KEY', 'ANTHROPIC_API_KEY', 'DATABASE_URL']
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`[Seed] Missing required environment variable: ${envVar}`)
      process.exit(1)
    }
  }

  console.info(`\n[Seed] ═══════════════════════════════════════════════════`)
  console.info(`[Seed] ${retryMode ? 'Retry mode' : 'Starting preload'} for ${tickers.length} companies`)
  console.info(`[Seed] Tickers: ${tickers.join(', ')}`)
  if (!retryMode) {
    console.info(`[Seed] Config: ${SEED_CONFIG.tenKCount} 10-Ks, ${SEED_CONFIG.defCount} DEF 14As, ${SEED_CONFIG.eightKMonths}mo 8-Ks`)
  }
  console.info(`[Seed] Concurrency: ${SEED_CONFIG.companyConcurrency} companies in parallel`)
  const embeddingModel = process.env.VOYAGE_EMBEDDING_MODEL ?? 'voyage-4-lite'
  console.info(`[Seed] Summarization: ${skipSummarization ? 'SKIPPED' : `enabled (Claude + Voyage AI ${embeddingModel})`}`)
  console.info(`[Seed] ═══════════════════════════════════════════════════\n`)

  const totalStart = Date.now()

  // Process companies with bounded concurrency
  const settled = await pMapSettled(
    tickers,
    (ticker, index) => seedCompany(ticker, index, tickers.length),
    SEED_CONFIG.companyConcurrency,
  )

  const results: Array<CompanyResult> = settled.map((entry, i) => {
    if (entry.status === 'fulfilled') return entry.value
    return {
      ticker: tickers[i],
      success: false,
      duration: 0,
      filings: { ingested: 0, skipped: 0 },
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    }
  })

  // ─── Summary ─────────────────────────────────────────────────────────────
  const totalDuration = Date.now() - totalStart
  const succeeded = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)
  const totalIngested = results.reduce((sum, r) => sum + r.filings.ingested, 0)

  console.info(`\n[Seed] ═══════════════════════════════════════════════════`)
  console.info(`[Seed] DONE — ${formatDuration(totalDuration)}`)
  console.info(`[Seed] ═══════════════════════════════════════════════════`)
  console.info(`[Seed] Succeeded: ${succeeded.length}/${tickers.length}`)
  console.info(`[Seed] Total filings ingested: ${totalIngested}`)

  if (failed.length > 0) {
    console.info(`[Seed] Failed companies:`)
    for (const r of failed) {
      console.info(`[Seed]   - ${r.ticker}: ${r.error}`)
    }
  }

  console.info(`[Seed] ═══════════════════════════════════════════════════\n`)

  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`[Seed] Fatal error:`, err)
  process.exit(1)
})
