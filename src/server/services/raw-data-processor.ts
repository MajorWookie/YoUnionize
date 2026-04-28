import { and, eq, sql } from 'drizzle-orm'
import {
  getDb,
  rawSecResponses,
  filingSummaries,
  executiveCompensation,
  insiderTrades,
  directors,
  form8kEvents,
} from '@union/postgres'
import { normalizeName } from '@union/helpers'
import type { CompanyRecord } from './company-lookup'
import { enrichCompensationNames, enrichDirectorRoles, enrichDirectorNames } from './enrichment'
import { summarizeCompanyFilings } from './summarization-pipeline'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProcessResult {
  processed: number
  failed: number
  errors: Array<string>
  summarization?: {
    summarized: number
    errors: Array<string>
  }
}

const TRANSACTION_CODE_MAP: Record<string, string> = {
  P: 'purchase',
  S: 'sale',
  A: 'grant',
  M: 'exercise',
  G: 'gift',
  H: 'holding',
}

/**
 * Phase 2: Process raw SEC API responses into domain tables, then run
 * summarization pipeline.
 *
 * Reads pending rows from raw_sec_responses, transforms each into the
 * appropriate domain table, then runs the existing summarization pipeline.
 */
export async function processRawSecData(
  company: CompanyRecord,
  options?: { skipSummarization?: boolean },
): Promise<ProcessResult> {
  const db = getDb()
  const result: ProcessResult = { processed: 0, failed: 0, errors: [] }

  // Get all pending raw responses for this company
  const pendingRows = await db
    .select()
    .from(rawSecResponses)
    .where(
      and(
        eq(rawSecResponses.companyId, company.id),
        eq(rawSecResponses.processStatus, 'pending'),
      ),
    )

  for (const row of pendingRows) {
    try {
      // Mark as processing
      await db
        .update(rawSecResponses)
        .set({ processStatus: 'processing' })
        .where(eq(rawSecResponses.id, row.id))

      await processRow(db, company, row)

      // Mark as processed
      await db
        .update(rawSecResponses)
        .set({
          processStatus: 'processed',
          processedAt: new Date().toISOString(),
        })
        .where(eq(rawSecResponses.id, row.id))

      result.processed++
    } catch (err) {
      const msg = `Failed to process ${row.endpoint}/${row.subKey ?? 'root'}: ${err instanceof Error ? err.message : String(err)}`
      console.info(`[RawDataProcessor] ${msg}`)
      result.errors.push(msg)
      result.failed++

      await db
        .update(rawSecResponses)
        .set({ processStatus: 'failed' })
        .where(eq(rawSecResponses.id, row.id))
    }
  }

  // Run enrichment (non-blocking — failures don't affect ingestion)
  try {
    await enrichCompensationNames(company.id)
  } catch (err) {
    console.info(`[RawDataProcessor] Compensation enrichment failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  try {
    await enrichDirectorRoles(company.id)
  } catch (err) {
    console.info(`[RawDataProcessor] Director role enrichment failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  try {
    await enrichDirectorNames(company.id)
  } catch (err) {
    console.info(`[RawDataProcessor] Director name enrichment failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Run summarization on filings that don't have aiSummary yet
  if (!options?.skipSummarization) {
    try {
      const summResult = await summarizeCompanyFilings(company.id, company.name)
      result.summarization = {
        summarized: summResult.summarized,
        errors: summResult.errors,
      }
    } catch (err) {
      const msg = `Summarization failed: ${err instanceof Error ? err.message : String(err)}`
      console.info(`[RawDataProcessor] ${msg}`)
      result.errors.push(msg)
    }
  }

  return result
}

// ─── Per-endpoint processors ─────────────────────────────────────────────

async function processRow(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  row: { endpoint: string; subKey: string | null; rawResponse: unknown },
): Promise<void> {
  const data = row.rawResponse as Record<string, unknown>

  switch (row.endpoint) {
    case 'filings':
      await processFilings(db, company, data)
      break
    case 'compensation':
      await processCompensation(db, company, data)
      break
    case 'insider_trading':
      await processInsiderTrading(db, company, data)
      break
    case 'directors':
      await processDirectors(db, company, data)
      break
    case 'form_8k':
      await processForm8K(db, company, data)
      break
    case 'xbrl':
      await processXbrl(db, company, row.subKey, data)
      break
    case 'sections':
      await processSections(db, company, row.subKey, data)
      break
  }
}

async function processFilings(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  data: Record<string, unknown>,
): Promise<void> {
  const filings = (data.filings ?? []) as Array<Record<string, unknown>>

  for (const filing of filings) {
    const accessionNo = filing.accessionNo as string
    if (!accessionNo) continue

    // Check for existing record
    const existing = await db
      .select({ id: filingSummaries.id })
      .from(filingSummaries)
      .where(eq(filingSummaries.accessionNumber, accessionNo))
      .limit(1)

    if (existing.length > 0) continue

    await db.insert(filingSummaries).values({
      companyId: company.id,
      filingType: (filing.formType as string) ?? 'UNKNOWN',
      periodEnd: (filing.periodOfReport as string) ?? null,
      filedAt: (filing.filedAt as string) ?? new Date().toISOString(),
      accessionNumber: accessionNo,
      rawData: filing,
      aiSummary: null,
    })
  }
}

async function processCompensation(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  data: Record<string, unknown>,
): Promise<void> {
  const execs = (data.data ?? []) as Array<Record<string, unknown>>
  const minYear = new Date().getFullYear() - 2 // 3 years of history

  for (const exec of execs) {
    const fiscalYear = (exec.year as number) ?? 0
    if (fiscalYear < minYear) continue

    const execName = (exec.name as string) ?? 'Unknown'
    const normalized = normalizeName(execName)

    await db.insert(executiveCompensation).values({
      companyId: company.id,
      fiscalYear,
      executiveName: execName,
      normalizedName: normalized,
      title: (exec.position as string) ?? 'Unknown',
      totalCompensation: (exec.total as number) ?? 0,
      salary: (exec.salary as number) ?? null,
      bonus: (exec.bonus as number) ?? null,
      stockAwards: (exec.stockAwards as number) ?? null,
      optionAwards: (exec.optionAwards as number) ?? null,
      nonEquityIncentive: (exec.nonEquityIncentiveCompensation as number) ?? null,
      otherCompensation: (exec.otherCompensation as number) ?? null,
      changeInPensionValue: (exec.changeInPensionValueAndDeferredEarnings as number) ?? null,
      ceoPayRatio: (exec.ceoPayRatio as string) ?? null,
    }).onConflictDoUpdate({
      target: [executiveCompensation.companyId, executiveCompensation.normalizedName, executiveCompensation.fiscalYear],
      set: {
        title: sql`EXCLUDED.title`,
        totalCompensation: sql`EXCLUDED.total_compensation`,
        salary: sql`EXCLUDED.salary`,
        bonus: sql`EXCLUDED.bonus`,
        stockAwards: sql`EXCLUDED.stock_awards`,
        optionAwards: sql`EXCLUDED.option_awards`,
      },
    })
  }
}

async function processInsiderTrading(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  data: Record<string, unknown>,
): Promise<void> {
  const trades = (data.transactions ?? []) as Array<Record<string, unknown>>

  for (const trade of trades) {
    const owner = trade.reportingOwner as Record<string, unknown> | undefined
    const ownerName = (owner?.name as string) ?? 'Unknown'
    const ownerTitle = (owner?.officerTitle as string) ?? null
    const accessionNo = trade.accessionNo as string | undefined

    const filingUrl = accessionNo ? buildFilingUrl(accessionNo) : null

    // Process non-derivative transactions
    const nonDeriv = trade.nonDerivativeTable as Record<string, unknown> | null
    const nonDerivTxs = (nonDeriv?.transactions ?? []) as Array<Record<string, unknown>>
    for (const tx of nonDerivTxs) {
      await insertTrade(db, company, trade, tx, ownerName, ownerTitle, filingUrl, false)
    }

    // Process non-derivative holdings (Form 3 initial ownership)
    const nonDerivHoldings = (nonDeriv?.holdings ?? []) as Array<Record<string, unknown>>
    for (const holding of nonDerivHoldings) {
      await insertTrade(db, company, trade, holding, ownerName, ownerTitle, filingUrl, false)
    }

    // Process derivative transactions
    const deriv = trade.derivativeTable as Record<string, unknown> | null
    const derivTxs = (deriv?.transactions ?? []) as Array<Record<string, unknown>>
    for (const tx of derivTxs) {
      await insertTrade(db, company, trade, tx, ownerName, ownerTitle, filingUrl, true)
    }

    // Process derivative holdings (Form 3 initial derivative positions)
    const derivHoldings = (deriv?.holdings ?? []) as Array<Record<string, unknown>>
    for (const holding of derivHoldings) {
      await insertTrade(db, company, trade, holding, ownerName, ownerTitle, filingUrl, true)
    }
  }
}

/** Fields extracted from each insider transaction — used to separate known fields from extras. */
const KNOWN_TX_FIELDS = new Set([
  'transactionDate', 'transactionCode', 'transactionDescription',
  'sharesTraded', 'pricePerShare', 'pricePerShareFootnoteId',
  'sharesOwnedAfter', 'directOrIndirect', 'securityTitle',
  'conversionOrExercisePrice', 'conversionOrExercisePriceFootnoteId',
  'exerciseDate', 'exerciseDateFootnoteId',
  'expirationDate', 'expirationDateFootnoteId',
  'underlyingSecurity',
])

async function insertTrade(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  trade: Record<string, unknown>,
  tx: Record<string, unknown>,
  ownerName: string,
  ownerTitle: string | null,
  filingUrl: string | null,
  isDerivative: boolean,
): Promise<void> {
  const txDate = (tx.transactionDate as string) ?? (trade.periodOfReport as string) ?? ''
  if (!txDate) return

  const txCode = (tx.transactionCode as string) ?? ''
  const isHolding = !txCode && !tx.transactionDate
  const transactionType = isHolding ? 'holding' : (TRANSACTION_CODE_MAP[txCode] ?? 'other')
  const shares = String((tx.sharesTraded as number) ?? 0)
  const pricePerShare = tx.pricePerShare != null ? String(tx.pricePerShare) : null
  const totalValue =
    tx.sharesTraded != null && tx.pricePerShare != null
      ? Math.round((tx.sharesTraded as number) * (tx.pricePerShare as number))
      : null

  const accessionNo = (trade.accessionNo as string) ?? null

  // Derivative-specific fields
  const underlying = tx.underlyingSecurity as Record<string, unknown> | undefined

  // Collect unmapped fields into extraData overflow
  const extras: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(tx)) {
    if (!KNOWN_TX_FIELDS.has(key) && value != null) {
      extras[key] = value
    }
  }
  const extraData = Object.keys(extras).length > 0 ? extras : null

  await db.insert(insiderTrades).values({
    companyId: company.id,
    filerName: ownerName,
    filerTitle: ownerTitle,
    transactionDate: txDate,
    transactionType,
    shares,
    pricePerShare,
    totalValue,
    filingUrl,
    isDerivative,
    accessionNumber: accessionNo,
    securityTitle: (tx.securityTitle as string) ?? null,
    sharesOwnedAfter: tx.sharesOwnedAfter != null ? String(tx.sharesOwnedAfter) : null,
    transactionDescription: (tx.transactionDescription as string) ?? null,
    directOrIndirect: (tx.directOrIndirect as string) ?? null,
    exerciseDate: (tx.exerciseDate as string) ?? null,
    expirationDate: (tx.expirationDate as string) ?? null,
    conversionOrExercisePrice: tx.conversionOrExercisePrice != null
      ? String(tx.conversionOrExercisePrice) : null,
    underlyingSecurityTitle: (underlying?.title as string) ?? null,
    underlyingSecurityShares: underlying?.shares != null
      ? String(underlying.shares) : null,
    extraData,
  }).onConflictDoNothing()
}

async function processDirectors(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  data: Record<string, unknown>,
): Promise<void> {
  const filings = (data.data ?? []) as Array<Record<string, unknown>>
  const seenNames = new Set<string>()

  // Sorted by filedAt desc, so first occurrence is most recent data
  for (const filing of filings) {
    const directorsList = (filing.directors ?? []) as Array<Record<string, unknown>>

    for (const director of directorsList) {
      const name = (director.name as string) ?? 'Unknown'
      const normalized = normalizeName(name)
      if (seenNames.has(normalized)) continue
      seenNames.add(normalized)

      const ageStr = director.age as string | null
      const age = ageStr ? parseInt(ageStr, 10) : null

      await db.insert(directors).values({
        companyId: company.id,
        name,
        normalizedName: normalized,
        title: emptyToNull(director.position as string) ?? 'Director',
        isIndependent: (director.isIndependent as boolean) ?? null,
        committees: (director.committeeMemberships as Array<string>) ?? null,
        tenureStart: emptyToNull(director.dateFirstElected as string),
        age: age && !isNaN(age) ? age : null,
        directorClass: emptyToNull(director.directorClass as string),
        qualifications: (director.qualificationsAndExperience as Array<string>) ?? null,
      }).onConflictDoUpdate({
        target: [directors.companyId, directors.normalizedName],
        set: {
          title: sql`EXCLUDED.title`,
          isIndependent: sql`EXCLUDED.is_independent`,
          committees: sql`EXCLUDED.committees`,
          tenureStart: sql`EXCLUDED.tenure_start`,
          age: sql`EXCLUDED.age`,
        },
      })
    }
  }
}

async function processForm8K(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  data: Record<string, unknown>,
): Promise<void> {
  const filings = (data.data ?? []) as Array<Record<string, unknown>>

  for (const filing of filings) {
    const accessionNo = (filing.accessionNo as string) ?? ''
    const filedAt = (filing.filedAt as string) ?? ''
    const items = filing.items as Record<string, unknown> | undefined

    if (!accessionNo || !filedAt || !items) continue

    const KNOWN_ITEM_MAP: Record<string, string> = {
      item101: '1.01',
      item102: '1.02',
      item201: '2.01',
      item202: '2.02',
      item203: '2.03',
      item204: '2.04',
      item205: '2.05',
      item206: '2.06',
      item301: '3.01',
      item302: '3.02',
      item303: '3.03',
      item401: '4.01',
      item402: '4.02',
      item501: '5.01',
      item502: '5.02',
      item503: '5.03',
      item504: '5.04',
      item505: '5.05',
      item506: '5.06',
      item507: '5.07',
      item508: '5.08',
      item601: '6.01',
      item701: '7.01',
      item801: '8.01',
      item901: '9.01',
    }

    for (const [itemKey, itemData] of Object.entries(items)) {
      if (!itemData || typeof itemData !== 'object') continue

      // Map known keys like "item401" → "4.01", or pass through unknown keys as-is
      const itemType = KNOWN_ITEM_MAP[itemKey] ?? itemKey

      // Dedup check
      const existing = await db
        .select({ id: form8kEvents.id })
        .from(form8kEvents)
        .where(
          and(
            eq(form8kEvents.accessionNumber, accessionNo),
            eq(form8kEvents.itemType, itemType),
          ),
        )
        .limit(1)

      if (existing.length > 0) continue

      await db.insert(form8kEvents).values({
        companyId: company.id,
        accessionNumber: accessionNo,
        filedAt,
        itemType,
        eventData: itemData,
      })
    }
  }
}

async function processXbrl(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  subKey: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  if (!subKey) return

  // Attach XBRL data to the filing's rawData
  const [filing] = await db
    .select({ id: filingSummaries.id, rawData: filingSummaries.rawData })
    .from(filingSummaries)
    .where(
      and(
        eq(filingSummaries.companyId, company.id),
        eq(filingSummaries.accessionNumber, subKey),
      ),
    )
    .limit(1)

  if (!filing) return

  const existingRawData = (filing.rawData ?? {}) as Record<string, unknown>
  existingRawData.xbrlData = data

  await db
    .update(filingSummaries)
    .set({ rawData: existingRawData })
    .where(eq(filingSummaries.id, filing.id))
}

async function processSections(
  db: ReturnType<typeof getDb>,
  company: CompanyRecord,
  subKey: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  if (!subKey) return

  // subKey format: "{accessionNo}:{sectionCode}"
  const [accessionNo, sectionCode] = subKey.split(':')
  if (!accessionNo || !sectionCode) return

  const text = data.text as string | undefined
  if (!text) return

  // Attach section text to the filing's rawData.extractedSections
  const [filing] = await db
    .select({ id: filingSummaries.id, rawData: filingSummaries.rawData })
    .from(filingSummaries)
    .where(
      and(
        eq(filingSummaries.companyId, company.id),
        eq(filingSummaries.accessionNumber, accessionNo),
      ),
    )
    .limit(1)

  if (!filing) return

  const existingRawData = (filing.rawData ?? {}) as Record<string, unknown>
  const sections = (existingRawData.extractedSections ?? {}) as Record<string, string>
  sections[sectionCode] = text
  existingRawData.extractedSections = sections

  await db
    .update(filingSummaries)
    .set({ rawData: existingRawData })
    .where(eq(filingSummaries.id, filing.id))
}

function buildFilingUrl(accessionNo: string): string {
  const noDashes = accessionNo.replace(/-/g, '')
  return `https://www.sec.gov/Archives/edgar/data/${noDashes.slice(0, 10)}/${noDashes}/${accessionNo}-index.htm`
}

function emptyToNull(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

