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
 *
 * Requires:
 *   - .env with SEC_API_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY, DATABASE_URL
 *   - Local Supabase running (supabase start)
 */

import { eq } from 'drizzle-orm'
import { getDb, filingSummaries } from '@union/postgres'
import { pMapSettled } from '@union/helpers'
import { getSecApiClient } from '../src/server/sec-api-client'
import { lookupCompany } from '../src/server/services/company-lookup'
import { ingestCompensation } from '../src/server/services/compensation-ingestion'
import { ingestInsiderTrading } from '../src/server/services/insider-trading-ingestion'
import { ingestDirectors } from '../src/server/services/directors-ingestion'
import { summarizeCompanyFilings } from '../src/server/services/summarization-pipeline'
import type { CompanyRecord } from '../src/server/services/company-lookup'
import type { Filing } from '@union/sec-api'
import { TenKSection } from '@union/sec-api'
import { startHeartbeat, stopHeartbeat, startPhase, endPhase } from './lib/progress'

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
  startPhase(company.ticker, 'fetching SEC filings (10-K / DEF 14A / 8-K)')

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

  let processedCount = 0
  for (const { filing, filingType } of allFilings) {
    processedCount++
    startPhase(
      company.ticker,
      `ingesting filing ${processedCount}/${allFilings.length} (${filingType})`,
    )
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

      // Build raw_data with extracted content
      const rawData: Record<string, unknown> = { ...filing }

      if ((filingType === '10-K' || filingType === 'DEF 14A') && filing.linkToFilingDetails) {
        const [xbrl, sections] = await Promise.all([
          filingType === '10-K' ? safeXbrl(filing) : Promise.resolve(null),
          extractSections(filing, filingType),
        ])
        if (xbrl) rawData.xbrlData = xbrl
        if (sections) rawData.extractedSections = sections
      }

      await db.insert(filingSummaries).values({
        companyId: company.id,
        filingType,
        periodEnd: filing.periodOfReport ?? null,
        filedAt: filing.filedAt,
        accessionNumber: filing.accessionNo,
        rawData,
        aiSummary: null,
      })

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

async function extractSections(
  filing: Filing,
  filingType: string,
): Promise<Record<string, string> | null> {
  const client = getSecApiClient()
  if (!filing.linkToFilingDetails) return null

  const sections: Record<string, string> = {}
  const url = filing.linkToFilingDetails

  const sectionItems =
    filingType === '10-K'
      ? [
        { key: 'businessOverview', item: TenKSection.BUSINESS_OVERVIEW },
        { key: 'riskFactors', item: TenKSection.RISK_FACTORS },
        { key: 'mdAndA', item: TenKSection.MD_AND_A },
        { key: 'legalProceedings', item: TenKSection.LEGAL_PROCEEDINGS },
      ]
      : filingType === 'DEF 14A'
        ? [
          { key: 'executiveCompensation', item: 'part1item7' as const },
          { key: 'proxy', item: 'part1item1' as const },
        ]
        : []

  const results = await Promise.allSettled(
    sectionItems.map(async ({ key, item }) => {
      const text = await client.extractSection(url, item)
      return { key, text }
    }),
  )

  for (const settledResult of results) {
    if (settledResult.status === 'fulfilled' && settledResult.value.text) {
      sections[settledResult.value.key] = settledResult.value.text
    }
  }

  return Object.keys(sections).length > 0 ? sections : null
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
  startPhase(ticker, 'looking up company (ticker → CIK)')

  try {
    // 1. Look up company (resolve ticker → CIK, upsert DB)
    const company = await lookupCompany(ticker)
    console.info(`[Seed] Company: ${company.name} (CIK: ${company.cik})`)

    // 2. Run ingestion pipelines in parallel
    startPhase(ticker, 'ingesting filings + comp + trades + directors (parallel)')
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
      console.info(`[Seed] [${ticker}] Summarizing filings...`)
      startPhase(ticker, 'AI summarization + Voyage embeddings')
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
    endPhase(ticker)

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
    console.info(`[Seed] ✗ ${ticker} FAILED: ${msg}`)
    endPhase(ticker)
    return {
      ticker,
      success: false,
      duration,
      filings: { ingested: 0, skipped: 0 },
      error: msg,
    }
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
  console.info(`[Seed] Starting preload for ${tickers.length} companies`)
  console.info(`[Seed] Tickers: ${tickers.join(', ')}`)
  console.info(`[Seed] Config: ${SEED_CONFIG.tenKCount} 10-Ks, ${SEED_CONFIG.defCount} DEF 14As, ${SEED_CONFIG.eightKMonths}mo 8-Ks`)
  console.info(`[Seed] Concurrency: ${SEED_CONFIG.companyConcurrency} companies in parallel`)
  const embeddingModel = process.env.VOYAGE_EMBEDDING_MODEL ?? 'voyage-4-lite'
  console.info(`[Seed] Summarization: ${skipSummarization ? 'SKIPPED' : `enabled (Claude + Voyage AI ${embeddingModel})`}`)
  console.info(`[Seed] ═══════════════════════════════════════════════════\n`)

  const totalStart = Date.now()
  startHeartbeat({ label: '[Seed]', intervalMs: 5000 })

  // Process companies with bounded concurrency
  const settled = await pMapSettled(
    tickers,
    (ticker, index) => seedCompany(ticker, index, tickers.length),
    SEED_CONFIG.companyConcurrency,
  )

  stopHeartbeat()

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
