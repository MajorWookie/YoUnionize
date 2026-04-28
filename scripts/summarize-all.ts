/**
 * Summarize-only utility: run AI summarization + embeddings for filings already
 * ingested in the database, without re-fetching from SEC.
 *
 * Idempotent — `summarizeCompanyFilings` only picks up rows below
 * CURRENT_SUMMARY_VERSION (or marked -1 for retry), so already-current filings
 * are skipped.
 *
 * Usage:
 *   bun run scripts/summarize-all.ts                  # all companies in DB
 *   bun run scripts/summarize-all.ts --tickers=VZ,XOM # specific tickers only
 *
 * Requires: SEC_API_KEY, ANTHROPIC_API_KEY, VOYAGE_API_KEY, DATABASE_URL
 */

import { inArray } from 'drizzle-orm'
import { getDb, companies } from '@younionize/postgres'
import { pMapSettled } from '@younionize/helpers'
import { summarizeCompanyFilings } from '../src/server/services/summarization-pipeline'
import { startHeartbeat, stopHeartbeat, startPhase, endPhase } from './lib/progress'

const COMPANY_CONCURRENCY = 2

const args = process.argv.slice(2)
const tickersFlag = args.find((a) => a.startsWith('--tickers='))
const tickerFilter = tickersFlag
  ? tickersFlag.split('=')[1].split(',').map((t) => t.trim().toUpperCase())
  : null

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

async function main() {
  const required = ['ANTHROPIC_API_KEY', 'VOYAGE_API_KEY', 'DATABASE_URL']
  for (const v of required) {
    if (!process.env[v]) {
      console.error(`[Summarize-All] Missing env: ${v}`)
      process.exit(1)
    }
  }

  const db = getDb()
  const targets = tickerFilter
    ? await db
        .select({ id: companies.id, ticker: companies.ticker, name: companies.name })
        .from(companies)
        .where(inArray(companies.ticker, tickerFilter))
    : await db
        .select({ id: companies.id, ticker: companies.ticker, name: companies.name })
        .from(companies)

  if (targets.length === 0) {
    console.info('[Summarize-All] No matching companies in DB.')
    return
  }

  console.info(`\n[Summarize-All] ═══════════════════════════════════════════════════`)
  console.info(`[Summarize-All] Processing ${targets.length} companies`)
  console.info(`[Summarize-All] Tickers: ${targets.map((t) => t.ticker).join(', ')}`)
  console.info(`[Summarize-All] Concurrency: ${COMPANY_CONCURRENCY}`)
  console.info(`[Summarize-All] ═══════════════════════════════════════════════════\n`)

  const totalStart = Date.now()
  startHeartbeat({ label: '[Summarize-All]', intervalMs: 5000 })
  let totalSummarized = 0
  let totalFilings = 0
  let totalErrors = 0
  let totalIn = 0
  let totalOut = 0

  const settled = await pMapSettled(
    targets,
    async (c) => {
      const start = Date.now()
      console.info(`[Summarize-All] ─── ${c.ticker} (${c.name}) ───`)
      startPhase(c.ticker, 'AI summarization + Voyage embeddings')
      try {
        const r = await summarizeCompanyFilings(c.id, c.name)
        const dur = formatDuration(Date.now() - start)
        console.info(
          `[Summarize-All] ✓ ${c.ticker}: ${r.summarized}/${r.total} filings (${r.tokenUsage.inputTokens} in / ${r.tokenUsage.outputTokens} out) [${dur}]`,
        )
        if (r.errors.length > 0) {
          console.info(`[Summarize-All] [${c.ticker}] Errors: ${r.errors.length}`)
          for (const e of r.errors.slice(0, 3)) {
            console.info(`[Summarize-All] [${c.ticker}]   - ${e}`)
          }
        }
        endPhase(c.ticker)
        return r
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.info(`[Summarize-All] ✗ ${c.ticker} FAILED: ${msg}`)
        endPhase(c.ticker)
        throw err
      }
    },
    COMPANY_CONCURRENCY,
  )

  stopHeartbeat()

  for (const entry of settled) {
    if (entry.status === 'fulfilled') {
      totalSummarized += entry.value.summarized
      totalFilings += entry.value.total
      totalErrors += entry.value.errors.length
      totalIn += entry.value.tokenUsage.inputTokens
      totalOut += entry.value.tokenUsage.outputTokens
    } else {
      totalErrors += 1
    }
  }

  const totalDur = formatDuration(Date.now() - totalStart)
  console.info(`\n[Summarize-All] ═══════════════════════════════════════════════════`)
  console.info(`[Summarize-All] DONE — ${totalDur}`)
  console.info(`[Summarize-All] Summarized: ${totalSummarized}/${totalFilings} filings`)
  console.info(`[Summarize-All] Tokens: ${totalIn} in / ${totalOut} out`)
  console.info(`[Summarize-All] Errors: ${totalErrors}`)
  console.info(`[Summarize-All] ═══════════════════════════════════════════════════\n`)
}

main().catch((err) => {
  console.error('[Summarize-All] Fatal:', err)
  process.exit(1)
})
