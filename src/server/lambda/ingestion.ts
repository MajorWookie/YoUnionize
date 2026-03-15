/**
 * Lambda handler for background filing ingestion.
 *
 * Invoked with a payload like: { ticker: "AAPL" }
 * Runs full ingestion pipeline (filings, compensation, insider trading, directors)
 * then summarization — same logic as the web API routes but decoupled from
 * the web process for long-running jobs.
 */

import { lookupCompany } from '../services/company-lookup'
import { ingestFilings } from '../services/filing-ingestion'
import { ingestCompensation } from '../services/compensation-ingestion'
import { ingestInsiderTrading } from '../services/insider-trading-ingestion'
import { ingestDirectors } from '../services/directors-ingestion'
import { summarizeCompanyFilings } from '../services/summarization-pipeline'

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
