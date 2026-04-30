/**
 * Validation harness for the PR 5b rollup-input rewrite.
 *
 * For each filing in scope:
 *   1. Read the EXISTING `filing_summaries.ai_summary` (the "old" output —
 *      produced under the rawData pipeline that's currently on main).
 *   2. Build the new aggregated section context (the same way the new
 *      pipeline does) and call `generateCompanySummary` +
 *      `generateEmployeeImpact` + `generateWorkforceSignals` on it.
 *   3. Optionally invoke a Sonnet judge with both outputs labelled A/B
 *      (randomised) to score factual accuracy / specificity / coverage.
 *   4. Write a markdown report side-by-side with judge scores aggregated
 *      at the end.
 *
 * Usage:
 *   bun run scripts/validate-rollup-rewrite.ts --tickers=AAPL,JPM,PFE
 *   bun run scripts/validate-rollup-rewrite.ts --tickers=AAPL --no-judge
 *   bun run scripts/validate-rollup-rewrite.ts --tickers=AAPL --limit-per-ticker=2
 *
 * Defaults:
 *   - --limit-per-ticker=1 (the most recent 10-K per ticker)
 *   - judge ENABLED unless --no-judge is passed
 *   - Sonnet judge model: claude-sonnet-4-6
 *   - Output written to validation-reports/rollup-rewrite-<timestamp>.md
 *
 * Cost (rough, with 5 tickers, judge on, 1 filing each):
 *   - 15 Haiku calls (3 new prompts × 5 filings)
 *   - 10 Sonnet calls (2 judge calls × 5 filings — exec_summary + employee_impact)
 *
 * Requires: ANTHROPIC_API_KEY, DATABASE_URL. VOYAGE_API_KEY not used here.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import {
  getDb,
  companies,
  filingSummaries,
} from '@younionize/postgres'
import Anthropic from '@anthropic-ai/sdk'
import type {
  CompanySummaryResult,
  EmployeeImpactResult,
  EmployeeOutlookResult,
  WorkforceSignalsResult,
} from '@younionize/ai'
import { transformXbrlToStatements } from '../server/services/xbrl-transformer'
import type { FinancialStatement } from '../server/services/xbrl-transformer'
import {
  buildAggregatedContext,
  findSectionTextByPromptKind,
  loadAllSectionSummariesByCode,
  loadAllSectionTextByCode,
  mergeEmployeeImpact,
} from '../server/services/summarization-pipeline'
import { getAiClient } from '../server/ai-client'

// ─── CLI args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const tickersFlag = args.find((a) => a.startsWith('--tickers='))
const limitFlag = args.find((a) => a.startsWith('--limit-per-ticker='))
const noJudge = args.includes('--no-judge')

if (!tickersFlag) {
  console.error('[Validate] Missing --tickers=<TICKER>[,<TICKER>...]')
  process.exit(1)
}

const tickers = tickersFlag.split('=')[1].split(',').map((t) => t.trim().toUpperCase())
const limitPerTicker = limitFlag ? Number(limitFlag.split('=')[1]) : 1
if (!Number.isFinite(limitPerTicker) || limitPerTicker < 1) {
  console.error('[Validate] --limit-per-ticker must be a positive integer')
  process.exit(1)
}

const required = ['ANTHROPIC_API_KEY', 'DATABASE_URL']
for (const v of required) {
  if (!process.env[v]) {
    console.error(`[Validate] Missing env: ${v}`)
    process.exit(1)
  }
}

const JUDGE_MODEL = 'claude-sonnet-4-6'
const REPORT_DIR = 'validation-reports'

// ─── Types ─────────────────────────────────────────────────────────────────

interface FilingSnapshot {
  ticker: string
  companyName: string
  filingId: string
  filingType: string
  accessionNumber: string
  periodOfReport: string | null
  oldExecutiveSummary: CompanySummaryResult | null
  oldEmployeeImpact: EmployeeImpactResult | null
}

interface NewRollupOutput {
  executiveSummary: CompanySummaryResult | null
  employeeImpact: EmployeeImpactResult | null
  outlook: EmployeeOutlookResult | null
  signals: WorkforceSignalsResult | null
  inputTokens: number
  outputTokens: number
}

interface JudgeVerdict {
  label: 'executive_summary' | 'employee_impact'
  newWasA: boolean // for de-randomising A/B
  factualAccuracyA: number
  factualAccuracyB: number
  specificityA: number
  specificityB: number
  coverageA: number
  coverageB: number
  notes: string
}

// ─── Filing selection ──────────────────────────────────────────────────────

async function loadCandidateFilings(): Promise<Array<FilingSnapshot>> {
  const db = getDb()
  const rows = await db
    .select({
      filingId: filingSummaries.id,
      filingType: filingSummaries.filingType,
      accessionNumber: filingSummaries.accessionNumber,
      periodOfReport: filingSummaries.periodEnd,
      filedAt: filingSummaries.filedAt,
      aiSummary: filingSummaries.aiSummary,
      ticker: companies.ticker,
      companyName: companies.name,
    })
    .from(filingSummaries)
    .innerJoin(companies, eq(filingSummaries.companyId, companies.id))
    .where(
      and(
        inArray(companies.ticker, tickers),
        inArray(filingSummaries.filingType, ['10-K', '10-Q']),
        isNotNull(filingSummaries.aiSummary),
      ),
    )
    .orderBy(desc(filingSummaries.filedAt))

  // Take up to limitPerTicker per ticker, preserving recency.
  const perTicker = new Map<string, Array<typeof rows[number]>>()
  for (const r of rows) {
    const arr = perTicker.get(r.ticker) ?? []
    if (arr.length < limitPerTicker) {
      arr.push(r)
      perTicker.set(r.ticker, arr)
    }
  }

  const snapshots: Array<FilingSnapshot> = []
  for (const arr of perTicker.values()) {
    for (const r of arr) {
      const summary = r.aiSummary as Record<string, unknown> | null
      snapshots.push({
        ticker: r.ticker,
        companyName: r.companyName,
        filingId: r.filingId,
        filingType: r.filingType,
        accessionNumber: r.accessionNumber,
        periodOfReport: r.periodOfReport,
        oldExecutiveSummary: (summary?.executive_summary as CompanySummaryResult | undefined) ?? null,
        oldEmployeeImpact: (summary?.employee_impact as EmployeeImpactResult | undefined) ?? null,
      })
    }
  }
  return snapshots
}

// ─── Generate new outputs ──────────────────────────────────────────────────

async function generateNewRollups(snapshot: FilingSnapshot): Promise<NewRollupOutput> {
  const ai = getAiClient()
  const result: NewRollupOutput = {
    executiveSummary: null,
    employeeImpact: null,
    outlook: null,
    signals: null,
    inputTokens: 0,
    outputTokens: 0,
  }

  // Build aggregated context using production helpers (so any drift between
  // harness and pipeline is caught at compile time).
  const sectionSummariesByCode = await loadAllSectionSummariesByCode(snapshot.filingId)
  const sectionTextByCode = await loadAllSectionTextByCode(snapshot.filingId)

  // We need filing.rawData for XBRL transformation. Read it from the DB.
  const db = getDb()
  const [filing] = await db
    .select({ rawData: filingSummaries.rawData })
    .from(filingSummaries)
    .where(eq(filingSummaries.id, snapshot.filingId))
    .limit(1)

  const xbrlData = (filing?.rawData as Record<string, unknown> | undefined)?.xbrlData as
    | Record<string, unknown>
    | undefined

  const xbrlStatements: Partial<Record<string, FinancialStatement>> = {}
  if (xbrlData) {
    const statements = transformXbrlToStatements(xbrlData)
    for (const key of ['income_statement', 'balance_sheet', 'cash_flow', 'shareholders_equity'] as const) {
      const stmt = statements[key]
      if (stmt) xbrlStatements[key] = stmt
    }
  }

  const aggregatedSections = buildAggregatedContext({
    filingMeta: {
      companyName: snapshot.companyName,
      filingType: snapshot.filingType,
      periodOfReport: snapshot.periodOfReport,
      accessionNumber: snapshot.accessionNumber,
    },
    sectionSummariesByCode,
    filingType: snapshot.filingType,
    xbrl: xbrlStatements as Partial<Record<'income_statement' | 'balance_sheet' | 'cash_flow' | 'shareholders_equity', FinancialStatement>>,
  })

  console.info(
    `[Validate] [${snapshot.ticker}] Aggregated context: ${aggregatedSections.length} chars (~${Math.ceil(aggregatedSections.length / 4)} tokens)`,
  )

  // Executive summary
  try {
    const r = await ai.generateCompanySummary({
      aggregatedSections,
      filingType: snapshot.filingType,
      companyName: snapshot.companyName,
    })
    result.executiveSummary = r.data
    result.inputTokens += r.usage.inputTokens
    result.outputTokens += r.usage.outputTokens
  } catch (err) {
    console.info(`[Validate] [${snapshot.ticker}] generateCompanySummary failed: ${(err as Error).message}`)
  }

  // Employee outlook
  try {
    const r = await ai.generateEmployeeImpact({
      aggregatedSections,
      filingType: snapshot.filingType,
      companyName: snapshot.companyName,
    })
    result.outlook = r.data
    result.inputTokens += r.usage.inputTokens
    result.outputTokens += r.usage.outputTokens
  } catch (err) {
    console.info(`[Validate] [${snapshot.ticker}] generateEmployeeImpact failed: ${(err as Error).message}`)
  }

  // Workforce signals
  try {
    const r = await ai.generateWorkforceSignals({
      companyName: snapshot.companyName,
      filingType: snapshot.filingType,
      businessOverview: findSectionTextByPromptKind(snapshot.filingType, sectionTextByCode, 'business_overview'),
      riskFactors: findSectionTextByPromptKind(snapshot.filingType, sectionTextByCode, 'risk_factors'),
    })
    result.signals = r.data
    result.inputTokens += r.usage.inputTokens
    result.outputTokens += r.usage.outputTokens
  } catch (err) {
    console.info(`[Validate] [${snapshot.ticker}] generateWorkforceSignals failed: ${(err as Error).message}`)
  }

  if (result.outlook || result.signals) {
    result.employeeImpact = mergeEmployeeImpact(result.outlook, result.signals)
  }

  return result
}

// ─── Sonnet judge ──────────────────────────────────────────────────────────

const JUDGE_SYSTEM_PROMPT = `You are an expert SEC-filing analyst evaluating two AI-generated summaries of the same filing. The two outputs are labelled A and B, randomised — you do not know which is "new" and which is "old".

Score each output on a 1-5 scale:
- factual_accuracy: 5 = every claim is supported by the filing context shown; 1 = multiple unsupported or hallucinated claims.
- specificity: 5 = uses concrete numbers, dollar amounts, percentages, named products/segments; 1 = vague generalities ("strong revenue", "robust growth").
- coverage: 5 = surfaces every signal a worker at this company should know about; 1 = misses major signals (layoffs, debt changes, new business lines, etc.) present in the filing.

Be a tough but fair judge. Do not penalise an output for being shorter — penalise it for being less accurate or less specific.

Respond with ONLY this JSON shape:
{
  "factual_accuracy_A": 1-5,
  "factual_accuracy_B": 1-5,
  "specificity_A": 1-5,
  "specificity_B": 1-5,
  "coverage_A": 1-5,
  "coverage_B": 1-5,
  "notes": "2-3 sentences calling out any specific hallucinations, missing signals, or vague claims in either output. Reference A and B by label."
}`

async function callJudge(args: {
  label: 'executive_summary' | 'employee_impact'
  filingContext: string
  outputA: string
  outputB: string
  newWasA: boolean
}): Promise<JudgeVerdict> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const userPrompt = `## Filing context (ground truth)

${args.filingContext}

---

## Output A (${args.label})

${args.outputA}

---

## Output B (${args.label})

${args.outputB}`

  const message = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    system: JUDGE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error(`Judge returned non-text block: ${block.type}`)

  // Extract JSON from response (handle code fences)
  let jsonStr = block.text.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) jsonStr = fenceMatch[1].trim()

  const parsed = JSON.parse(jsonStr) as {
    factual_accuracy_A: number
    factual_accuracy_B: number
    specificity_A: number
    specificity_B: number
    coverage_A: number
    coverage_B: number
    notes: string
  }

  return {
    label: args.label,
    newWasA: args.newWasA,
    factualAccuracyA: parsed.factual_accuracy_A,
    factualAccuracyB: parsed.factual_accuracy_B,
    specificityA: parsed.specificity_A,
    specificityB: parsed.specificity_B,
    coverageA: parsed.coverage_A,
    coverageB: parsed.coverage_B,
    notes: parsed.notes,
  }
}

// ─── Report rendering ──────────────────────────────────────────────────────

function fmtJson(v: unknown): string {
  return '```json\n' + JSON.stringify(v, null, 2) + '\n```'
}

function renderFilingSection(snapshot: FilingSnapshot, output: NewRollupOutput, verdicts: Array<JudgeVerdict>): string {
  const lines: Array<string> = []
  lines.push(`## ${snapshot.ticker} — ${snapshot.filingType} (${snapshot.accessionNumber})`)
  lines.push(`Period: ${snapshot.periodOfReport ?? 'n/a'}`)
  lines.push('')
  lines.push(`**Token cost (new path):** ${output.inputTokens} input / ${output.outputTokens} output`)
  lines.push('')

  lines.push('### Executive Summary — old (rawData) vs new (aggregated)')
  lines.push('')
  lines.push('**OLD:**')
  lines.push(snapshot.oldExecutiveSummary ? fmtJson(snapshot.oldExecutiveSummary) : '_(not present)_')
  lines.push('')
  lines.push('**NEW:**')
  lines.push(output.executiveSummary ? fmtJson(output.executiveSummary) : '_(generation failed)_')
  lines.push('')

  lines.push('### Employee Impact — old vs new (merged outlook + workforce_signals)')
  lines.push('')
  lines.push('**OLD:**')
  lines.push(snapshot.oldEmployeeImpact ? fmtJson(snapshot.oldEmployeeImpact) : '_(not present)_')
  lines.push('')
  lines.push('**NEW:**')
  lines.push(output.employeeImpact ? fmtJson(output.employeeImpact) : '_(generation failed)_')
  lines.push('')

  if (verdicts.length > 0) {
    lines.push('### Judge verdicts')
    lines.push('')
    for (const v of verdicts) {
      const newScore = (key: 'factualAccuracy' | 'specificity' | 'coverage'): number =>
        v.newWasA ? v[`${key}A` as const] : v[`${key}B` as const]
      const oldScore = (key: 'factualAccuracy' | 'specificity' | 'coverage'): number =>
        v.newWasA ? v[`${key}B` as const] : v[`${key}A` as const]

      lines.push(`**${v.label}** — new shown as ${v.newWasA ? 'A' : 'B'}`)
      lines.push('')
      lines.push(`| Metric | Old | New | Δ |`)
      lines.push(`|---|---|---|---|`)
      lines.push(`| Factual accuracy | ${oldScore('factualAccuracy')} | ${newScore('factualAccuracy')} | ${(newScore('factualAccuracy') - oldScore('factualAccuracy')).toFixed(1)} |`)
      lines.push(`| Specificity | ${oldScore('specificity')} | ${newScore('specificity')} | ${(newScore('specificity') - oldScore('specificity')).toFixed(1)} |`)
      lines.push(`| Coverage | ${oldScore('coverage')} | ${newScore('coverage')} | ${(newScore('coverage') - oldScore('coverage')).toFixed(1)} |`)
      lines.push('')
      lines.push(`> ${v.notes}`)
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

function renderSummaryTable(allVerdicts: Array<JudgeVerdict>): string {
  if (allVerdicts.length === 0) return ''

  const lines: Array<string> = []
  lines.push('## Aggregate scores')
  lines.push('')

  const buckets = ['executive_summary', 'employee_impact'] as const
  for (const bucket of buckets) {
    const verdicts = allVerdicts.filter((v) => v.label === bucket)
    if (verdicts.length === 0) continue

    const oldFA = verdicts.reduce((acc, v) => acc + (v.newWasA ? v.factualAccuracyB : v.factualAccuracyA), 0) / verdicts.length
    const newFA = verdicts.reduce((acc, v) => acc + (v.newWasA ? v.factualAccuracyA : v.factualAccuracyB), 0) / verdicts.length
    const oldSpec = verdicts.reduce((acc, v) => acc + (v.newWasA ? v.specificityB : v.specificityA), 0) / verdicts.length
    const newSpec = verdicts.reduce((acc, v) => acc + (v.newWasA ? v.specificityA : v.specificityB), 0) / verdicts.length
    const oldCov = verdicts.reduce((acc, v) => acc + (v.newWasA ? v.coverageB : v.coverageA), 0) / verdicts.length
    const newCov = verdicts.reduce((acc, v) => acc + (v.newWasA ? v.coverageA : v.coverageB), 0) / verdicts.length

    lines.push(`### ${bucket} (n=${verdicts.length})`)
    lines.push('')
    lines.push(`| Metric | Old (mean) | New (mean) | Δ |`)
    lines.push(`|---|---|---|---|`)
    lines.push(`| Factual accuracy | ${oldFA.toFixed(2)} | ${newFA.toFixed(2)} | ${(newFA - oldFA).toFixed(2)} |`)
    lines.push(`| Specificity | ${oldSpec.toFixed(2)} | ${newSpec.toFixed(2)} | ${(newSpec - oldSpec).toFixed(2)} |`)
    lines.push(`| Coverage | ${oldCov.toFixed(2)} | ${newCov.toFixed(2)} | ${(newCov - oldCov).toFixed(2)} |`)
    lines.push('')
  }

  lines.push('**Acceptance bar (PR 5b):** new factual accuracy ≥ 95% of old AND coverage ≥ 90% of old. Per-question scores within 0.3 points of baseline; no question regresses by more than 1 point on any metric.')
  lines.push('')
  return lines.join('\n')
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.info(`[Validate] Tickers: ${tickers.join(', ')}`)
  console.info(`[Validate] Limit per ticker: ${limitPerTicker}`)
  console.info(`[Validate] Judge: ${noJudge ? 'OFF' : `ON (${JUDGE_MODEL})`}`)

  const snapshots = await loadCandidateFilings()
  console.info(`[Validate] Loaded ${snapshots.length} candidate filings\n`)

  if (snapshots.length === 0) {
    console.info('[Validate] No matching filings — try different tickers or check that they have ai_summary set.')
    return
  }

  const reportSections: Array<string> = []
  const allVerdicts: Array<JudgeVerdict> = []
  let totalIn = 0
  let totalOut = 0

  for (const snap of snapshots) {
    console.info(`[Validate] ─── ${snap.ticker} ${snap.filingType} ${snap.accessionNumber} ───`)
    const newOutput = await generateNewRollups(snap)
    totalIn += newOutput.inputTokens
    totalOut += newOutput.outputTokens

    const verdicts: Array<JudgeVerdict> = []
    if (!noJudge) {
      // Build a compact filing context for the judge — just show it the section
      // summaries + XBRL the new path saw, so accuracy is judged on the same
      // ground truth. (We don't pass the full raw filing because Sonnet's
      // context can't fit a 500k-token blob anyway.)
      const sectionSummaries = await loadAllSectionSummariesByCode(snap.filingId)
      const filingContext = Array.from(sectionSummaries.entries())
        .map(([code, summary]) => `### Section ${code}\n${summary}`)
        .join('\n\n')

      // executive_summary
      if (snap.oldExecutiveSummary && newOutput.executiveSummary) {
        const newWasA = Math.random() < 0.5
        try {
          const verdict = await callJudge({
            label: 'executive_summary',
            filingContext,
            outputA: newWasA ? JSON.stringify(newOutput.executiveSummary, null, 2) : JSON.stringify(snap.oldExecutiveSummary, null, 2),
            outputB: newWasA ? JSON.stringify(snap.oldExecutiveSummary, null, 2) : JSON.stringify(newOutput.executiveSummary, null, 2),
            newWasA,
          })
          verdicts.push(verdict)
          allVerdicts.push(verdict)
        } catch (err) {
          console.info(`[Validate] [${snap.ticker}] judge (executive_summary) failed: ${(err as Error).message}`)
        }
      }

      // employee_impact
      if (snap.oldEmployeeImpact && newOutput.employeeImpact) {
        const newWasA = Math.random() < 0.5
        try {
          const verdict = await callJudge({
            label: 'employee_impact',
            filingContext,
            outputA: newWasA ? JSON.stringify(newOutput.employeeImpact, null, 2) : JSON.stringify(snap.oldEmployeeImpact, null, 2),
            outputB: newWasA ? JSON.stringify(snap.oldEmployeeImpact, null, 2) : JSON.stringify(newOutput.employeeImpact, null, 2),
            newWasA,
          })
          verdicts.push(verdict)
          allVerdicts.push(verdict)
        } catch (err) {
          console.info(`[Validate] [${snap.ticker}] judge (employee_impact) failed: ${(err as Error).message}`)
        }
      }
    }

    reportSections.push(renderFilingSection(snap, newOutput, verdicts))
  }

  // ── Report output ────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  await mkdir(REPORT_DIR, { recursive: true })
  const reportPath = path.join(REPORT_DIR, `rollup-rewrite-${ts}.md`)

  const header = [
    '# Rollup-Rewrite Validation Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Tickers: ${tickers.join(', ')}`,
    `Filings: ${snapshots.length}`,
    `Judge: ${noJudge ? 'disabled' : JUDGE_MODEL}`,
    `Total tokens (new path): ${totalIn} in / ${totalOut} out`,
    '',
    '---',
    '',
  ].join('\n')

  await writeFile(reportPath, header + reportSections.join('\n') + '\n' + renderSummaryTable(allVerdicts), 'utf-8')

  console.info(`\n[Validate] DONE`)
  console.info(`[Validate] Report: ${reportPath}`)
  console.info(`[Validate] Total tokens (new path only): ${totalIn} in / ${totalOut} out`)
  if (allVerdicts.length > 0) {
    const oldFA = allVerdicts.reduce((a, v) => a + (v.newWasA ? v.factualAccuracyB : v.factualAccuracyA), 0) / allVerdicts.length
    const newFA = allVerdicts.reduce((a, v) => a + (v.newWasA ? v.factualAccuracyA : v.factualAccuracyB), 0) / allVerdicts.length
    console.info(`[Validate] Mean factual accuracy — old: ${oldFA.toFixed(2)}, new: ${newFA.toFixed(2)}`)
  }
}

main().catch((err) => {
  console.error('[Validate] Fatal:', err)
  process.exit(1)
})
