/**
 * Lambda handler for background filing ingestion.
 *
 * Supports three modes:
 * - Legacy `handler`: Interleaved fetch+process (deprecated, kept for backward compat)
 * - `fetchHandler`: Phase 1 — fetch ALL SEC data and store raw responses
 * - `processHandler`: Phase 2 — transform raw responses into domain tables + summarize
 * - `fetchBatchHandler`: Enqueue individual fetch jobs for multiple companies
 */

import { eq } from 'drizzle-orm'
import { getDb, jobs } from '@union/postgres'
import { lookupCompany, getCompanyByTicker } from '../services/company-lookup'
import { ingestFilings } from '../services/filing-ingestion'
import { ingestCompensation } from '../services/compensation-ingestion'
import { ingestInsiderTrading } from '../services/insider-trading-ingestion'
import { ingestDirectors } from '../services/directors-ingestion'
import { summarizeCompanyFilings } from '../services/summarization-pipeline'
import { fetchAllSecData } from '../services/sec-fetcher'
import { processRawSecData } from '../services/raw-data-processor'

interface IngestionEvent {
  ticker: string
  skipSummarization?: boolean
}

export async function handler(event: IngestionEvent) {
  const { ticker, skipSummarization } = event

  if (!ticker) {
    throw new Error('Missing required field: ticker')
  }

  console.info(`[Lambda:Ingestion] Starting for ${ticker}`)

  // 1. Look up company (creates DB record if needed)
  const company = await lookupCompany(ticker)
  console.info(`[Lambda:Ingestion] Company: ${company.name} (${company.ticker})`)

  // 2. Run all ingestion pipelines in parallel
  const [filings, compensation, insiderTrading, directors] = await Promise.allSettled([
    ingestFilings(company),
    ingestCompensation(company),
    ingestInsiderTrading(company),
    ingestDirectors(company),
  ])

  const ingestionSummary = {
    filings:
      filings.status === 'fulfilled'
        ? filings.value
        : { error: filings.reason?.message },
    compensation:
      compensation.status === 'fulfilled'
        ? compensation.value
        : { error: compensation.reason?.message },
    insiderTrading:
      insiderTrading.status === 'fulfilled'
        ? insiderTrading.value
        : { error: insiderTrading.reason?.message },
    directors:
      directors.status === 'fulfilled'
        ? directors.value
        : { error: directors.reason?.message },
  }

  console.info(`[Lambda:Ingestion] Ingestion complete:`, JSON.stringify(ingestionSummary))

  // 3. Run AI summarization if not skipped
  let summarizationResult = null
  if (!skipSummarization) {
    try {
      summarizationResult = await summarizeCompanyFilings(company.id, company.name)
      console.info(
        `[Lambda:Ingestion] Summarization complete: ${summarizationResult.summarized}/${summarizationResult.total}`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.info(`[Lambda:Ingestion] Summarization failed: ${msg}`)
      summarizationResult = { error: msg }
    }
  }

  return {
    statusCode: 200,
    body: {
      company: { ticker: company.ticker, name: company.name },
      ingestion: ingestionSummary,
      summarization: summarizationResult,
    },
  }
}

// ─── Phase 1: Fetch Handler ──────────────────────────────────────────────

interface FetchEvent {
  ticker: string
}

/**
 * Phase 1 handler: Fetch ALL SEC data for a company and store raw responses.
 * No transformation, no LLM calls.
 */
export async function fetchHandler(event: FetchEvent) {
  const { ticker } = event
  if (!ticker) throw new Error('Missing required field: ticker')

  console.info(`[Lambda:Fetch] Starting for ${ticker}`)

  const company = await lookupCompany(ticker)
  console.info(`[Lambda:Fetch] Company: ${company.name} (${company.ticker})`)

  const result = await fetchAllSecData(company)
  console.info(`[Lambda:Fetch] Complete:`, JSON.stringify(result.endpoints))

  return {
    statusCode: 200,
    body: {
      company: { ticker: company.ticker, name: company.name },
      fetch: result.endpoints,
    },
  }
}

// ─── Phase 2: Process Handler ────────────────────────────────────────────

interface ProcessEvent {
  ticker: string
  skipSummarization?: boolean
}

/**
 * Phase 2 handler: Transform raw SEC responses into domain tables,
 * then run AI summarization.
 */
export async function processHandler(event: ProcessEvent) {
  const { ticker, skipSummarization } = event
  if (!ticker) throw new Error('Missing required field: ticker')

  console.info(`[Lambda:Process] Starting for ${ticker}`)

  const company = await getCompanyByTicker(ticker)
  if (!company) throw new Error(`Company not found: ${ticker}`)

  const result = await processRawSecData(company, { skipSummarization })
  console.info(
    `[Lambda:Process] Complete: ${result.processed} processed, ${result.failed} failed`,
  )

  return {
    statusCode: 200,
    body: {
      company: { ticker: company.ticker, name: company.name },
      processing: {
        processed: result.processed,
        failed: result.failed,
        errors: result.errors,
      },
      summarization: result.summarization,
    },
  }
}

// ─── Batch Fetch Handler ────────────────────────────────────────────────

interface FetchBatchEvent {
  tickers: Array<string>
  parentJobId?: string
}

/**
 * Enqueue individual fetch jobs for multiple companies.
 * Each company gets its own job for fault isolation.
 */
export async function fetchBatchHandler(event: FetchBatchEvent) {
  const { tickers, parentJobId } = event
  if (!tickers || tickers.length === 0) {
    throw new Error('Missing required field: tickers')
  }

  console.info(`[Lambda:FetchBatch] Enqueuing ${tickers.length} fetch jobs`)

  const db = getDb()
  const jobIds: Array<string> = []

  for (const ticker of tickers) {
    const [job] = await db
      .insert(jobs)
      .values({
        type: 'fetch',
        payload: { ticker },
        parentJobId: parentJobId ?? null,
      })
      .returning({ id: jobs.id })

    jobIds.push(job.id)
  }

  console.info(`[Lambda:FetchBatch] Enqueued ${jobIds.length} jobs`)

  return {
    statusCode: 200,
    body: {
      enqueued: jobIds.length,
      jobIds,
    },
  }
}
