#!/usr/bin/env bun
/**
 * Side-by-side eval: frozen v1 prompt vs. current live prompt for a section.
 *
 * This script supports the Phase 3 rollout of Council Workbench prompts.
 * After you replace a live module under `packages/ai/src/prompts/<kind>.ts`
 * with a new prompt, run this script to see how the new prompt's outputs
 * compare to the v1 prompt's outputs on the same real-world inputs from
 * your DB. Use the resulting markdown report for manual scoring (a 1–5
 * rubric across factual accuracy, employee-relevance, specificity,
 * readability, and structural clarity is plenty).
 *
 * The "v1" content lives in `scripts/eval/v1-section-prompts.ts` — a
 * frozen-in-time copy of the live prompts as of 2026-04-30 (post-Phase-2).
 * If you have not yet edited the live module for `<kind>`, the v1 and
 * live prompts will be byte-identical and the eval will only show
 * sampling variance.
 *
 * Usage:
 *   bunx dotenvx run -f .env.remote -- \
 *     bun run scripts/eval-section-prompt.ts --kind risk_factors --limit 5
 *
 *   # Choose a different output path
 *   bunx dotenvx run -f .env.remote -- \
 *     bun run scripts/eval-section-prompt.ts \
 *       --kind risk_factors --limit 10 --out /tmp/risk-factors-eval.md
 *
 * Requires: ANTHROPIC_API_KEY, DATABASE_URL.
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { sql } from 'drizzle-orm'
import { getDb } from '@younionize/postgres'
import * as live from '@younionize/ai'
import {
  V1_SECTION_PROMPTS,
  V1_KINDS,
  type V1Kind,
  type V1PromptParams,
} from './eval/v1-section-prompts'

// ─── CLI argument parsing ────────────────────────────────────────────────

interface EvalArgs {
  kind: V1Kind
  limit: number
  outPath: string
}

function parseArgs(): EvalArgs {
  const argv = process.argv.slice(2)

  const flag = (name: string): string | undefined => {
    const eqForm = argv.find((a) => a.startsWith(`--${name}=`))
    if (eqForm) return eqForm.split('=').slice(1).join('=')
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv[i + 1] : undefined
  }

  const kindArg = flag('kind')
  if (!kindArg) {
    console.error('Missing --kind. Valid kinds:')
    console.error(`  ${V1_KINDS.join(', ')}`)
    process.exit(1)
  }
  if (!V1_KINDS.includes(kindArg as V1Kind)) {
    console.error(`Invalid --kind: "${kindArg}". Valid kinds:`)
    console.error(`  ${V1_KINDS.join(', ')}`)
    process.exit(1)
  }

  const limitArg = flag('limit')
  const limit = limitArg ? Math.max(1, Number.parseInt(limitArg, 10)) : 5
  if (Number.isNaN(limit)) {
    console.error(`Invalid --limit: "${limitArg}". Must be a positive integer.`)
    process.exit(1)
  }

  const outArg = flag('out')
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const defaultOut = path.join('eval-outputs', `${kindArg}-${ts}.md`)
  const outPath = outArg ?? defaultOut

  return { kind: kindArg as V1Kind, limit, outPath }
}

// ─── DB sampling ─────────────────────────────────────────────────────────

interface SampleRow {
  filingSectionId: string
  filingId: string
  sectionCode: string
  text: string
  filingType: string
  companyName: string
  ticker: string
}

async function fetchSamples(kind: V1Kind, limit: number): Promise<SampleRow[]> {
  // Filter by `prompt_id LIKE '<kind>@%'` — that means the section was
  // summarized under this prompt kind in production at some point. The
  // version suffix (@v1, @v2…) doesn't matter for sampling; we just need
  // representative content.
  const db = getDb()
  const rows = (await db.execute(sql`
    SELECT
      fs.id           AS filing_section_id,
      fs.filing_id    AS filing_id,
      fs.section_code AS section_code,
      fs.text         AS text,
      f.filing_type   AS filing_type,
      c.name          AS company_name,
      c.ticker        AS ticker
    FROM filing_sections fs
    JOIN filing_summaries f ON f.id = fs.filing_id
    JOIN companies c        ON c.id = f.company_id
    WHERE fs.prompt_id LIKE ${`${kind}@%`}
      AND fs.text IS NOT NULL
      AND length(fs.text) > 1000
    ORDER BY random()
    LIMIT ${limit}
  `)) as Array<Record<string, unknown>>

  return rows.map((r) => ({
    filingSectionId: String(r.filing_section_id),
    filingId: String(r.filing_id),
    sectionCode: String(r.section_code),
    text: String(r.text),
    filingType: String(r.filing_type),
    companyName: String(r.company_name),
    ticker: String(r.ticker),
  }))
}

// ─── Live prompt resolver ────────────────────────────────────────────────

interface LivePromptPair {
  maxTokens: number
  system: string
  user: (p: V1PromptParams) => string
}

function getLivePrompt(kind: V1Kind): LivePromptPair {
  switch (kind) {
    case 'business_overview':
      return {
        maxTokens: 2048,
        system: live.businessOverviewSummarySystemPrompt(),
        user: (p) => live.businessOverviewSummaryUserPrompt(p),
      }
    case 'risk_factors':
      return {
        maxTokens: 2048,
        system: live.riskFactorsSummarySystemPrompt(),
        user: (p) => live.riskFactorsSummaryUserPrompt(p),
      }
    case 'legal_proceedings':
      return {
        maxTokens: 2048,
        system: live.legalProceedingsSummarySystemPrompt(),
        user: (p) => live.legalProceedingsSummaryUserPrompt(p),
      }
    case 'financial_footnotes':
      return {
        maxTokens: 2048,
        system: live.financialFootnotesSummarySystemPrompt(),
        user: (p) => live.financialFootnotesSummaryUserPrompt(p),
      }
    case 'executive_compensation':
      return {
        maxTokens: 2048,
        system: live.executiveCompensationSummarySystemPrompt(),
        user: (p) => live.executiveCompensationSummaryUserPrompt(p),
      }
    case 'cybersecurity':
      return {
        maxTokens: 2048,
        system: live.cybersecuritySummarySystemPrompt(),
        user: (p) => live.cybersecuritySummaryUserPrompt(p),
      }
    case 'controls_and_procedures':
      return {
        maxTokens: 2048,
        system: live.controlsAndProceduresSummarySystemPrompt(),
        user: (p) => live.controlsAndProceduresSummaryUserPrompt(p),
      }
    case 'related_transactions':
      return {
        maxTokens: 2048,
        system: live.relatedTransactionsSummarySystemPrompt(),
        user: (p) => live.relatedTransactionsSummaryUserPrompt(p),
      }
    case 'proxy':
      return {
        maxTokens: 2048,
        system: live.proxySummarySystemPrompt(),
        user: (p) => live.proxySummaryUserPrompt(p),
      }
    case 'event_8k':
      return {
        maxTokens: 2048,
        system: live.event8kSummarySystemPrompt(),
        user: (p) => live.event8kSummaryUserPrompt(p),
      }
    case 'narrative':
      return {
        maxTokens: 2048,
        system: live.narrativeSummarySystemPrompt(),
        user: (p) => live.narrativeSummaryUserPrompt(p),
      }
    case 'mda':
      return {
        maxTokens: 3072,
        system: live.mdaSummarySystemPrompt(),
        user: (p) => live.mdaSummaryUserPrompt(p),
      }
  }
}

// ─── Claude invocation ───────────────────────────────────────────────────

const MODEL = 'claude-haiku-4-5'

interface RunResult {
  text: string
  inputTokens: number
  outputTokens: number
  durationMs: number
  error?: string
}

async function runPrompt(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<RunResult> {
  const startedAt = Date.now()
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const block = response.content[0]
    const text = block && block.type === 'text' ? block.text : '[no text content]'
    return {
      text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      text: '',
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Report writer ───────────────────────────────────────────────────────

interface SampleResult {
  sample: SampleRow
  v1: RunResult
  liveResult: RunResult
}

const SOURCE_TEXT_PREVIEW_CHARS = 2000

function formatTokens(r: RunResult): string {
  if (r.error) return `error: ${r.error}`
  return `${r.inputTokens} in / ${r.outputTokens} out · ${r.durationMs}ms`
}

function formatOutput(r: RunResult): string {
  if (r.error) return `> _Claude call failed: ${r.error}_`
  return r.text || '_(empty)_'
}

async function writeReport(
  args: EvalArgs,
  results: SampleResult[],
  liveSystemPrompt: string,
  v1SystemPrompt: string,
): Promise<void> {
  const promptsAreIdentical = liveSystemPrompt === v1SystemPrompt
  const lines: string[] = [
    `# Eval — \`${args.kind}\``,
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Model:** \`${MODEL}\``,
    `**Sample size:** ${results.length}`,
    `**Live prompt vs. v1 prompt:** ${promptsAreIdentical ? '⚠️  byte-identical (this section has not been updated yet — the eval will only show sampling variance)' : 'differ ✓'}`,
    '',
    '## How to read this report',
    '',
    'For each sample, the source SEC text is shown (truncated to ~2k chars), followed by two outputs:',
    '',
    '- **v1:** the frozen prompt from `scripts/eval/v1-section-prompts.ts`',
    '- **Live:** the current prompt from `packages/ai/src/prompts/<kind>.ts`',
    '',
    'Score each pair on a 1–5 rubric: factual accuracy, employee relevance, specificity, readability, structural clarity. Aggregate scores below the per-sample diffs and decide whether to ship the live prompt.',
    '',
    '---',
    '',
  ]

  results.forEach((r, i) => {
    lines.push(
      `## Sample ${i + 1}: ${r.sample.companyName} (${r.sample.ticker}) — ${r.sample.filingType} item ${r.sample.sectionCode}`,
      '',
      `_filing_section_id: \`${r.sample.filingSectionId}\` · ${r.sample.text.length.toLocaleString()} chars_`,
      '',
      `<details><summary>Source text (first ${SOURCE_TEXT_PREVIEW_CHARS.toLocaleString()} chars)</summary>`,
      '',
      '```',
      r.sample.text.slice(0, SOURCE_TEXT_PREVIEW_CHARS) +
        (r.sample.text.length > SOURCE_TEXT_PREVIEW_CHARS ? '\n[…truncated…]' : ''),
      '```',
      '',
      '</details>',
      '',
      `### v1 output  _(${formatTokens(r.v1)})_`,
      '',
      formatOutput(r.v1),
      '',
      `### Live output  _(${formatTokens(r.liveResult)})_`,
      '',
      formatOutput(r.liveResult),
      '',
      '---',
      '',
    )
  })

  // Token / latency summary
  const totalV1Tokens = results.reduce((s, r) => s + r.v1.outputTokens, 0)
  const totalLiveTokens = results.reduce((s, r) => s + r.liveResult.outputTokens, 0)
  const totalV1Latency = results.reduce((s, r) => s + r.v1.durationMs, 0)
  const totalLiveLatency = results.reduce((s, r) => s + r.liveResult.durationMs, 0)
  lines.push(
    '## Aggregate stats',
    '',
    '| Metric | v1 | Live |',
    '|---|---:|---:|',
    `| Total output tokens | ${totalV1Tokens.toLocaleString()} | ${totalLiveTokens.toLocaleString()} |`,
    `| Avg output tokens / sample | ${Math.round(totalV1Tokens / results.length).toLocaleString()} | ${Math.round(totalLiveTokens / results.length).toLocaleString()} |`,
    `| Total latency (ms) | ${totalV1Latency.toLocaleString()} | ${totalLiveLatency.toLocaleString()} |`,
    `| Avg latency / sample (ms) | ${Math.round(totalV1Latency / results.length).toLocaleString()} | ${Math.round(totalLiveLatency / results.length).toLocaleString()} |`,
    '',
    '## Manual scoring template',
    '',
    'Copy the table below and fill in scores. Aim for honest scoring against a fixed rubric, not "which one looks fancier."',
    '',
    '| Sample | Accuracy | Employee Rel. | Specificity | Readability | Structure | Notes |',
    '|---|:-:|:-:|:-:|:-:|:-:|---|',
    ...results.map((r, i) =>
      `| ${i + 1} (${r.sample.ticker}) v1 vs. live | _/5_ vs. _/5_ | _/5_ vs. _/5_ | _/5_ vs. _/5_ | _/5_ vs. _/5_ | _/5_ vs. _/5_ |  |`,
    ),
    '',
    '**Decision rule:** ship the live prompt if its average across all rubric dimensions is ≥0.5 points higher than v1. If lift is <0.3, revert. If between 0.3 and 0.5, iterate the prompt and re-run.',
    '',
  )

  await fs.mkdir(path.dirname(args.outPath), { recursive: true })
  await fs.writeFile(args.outPath, lines.join('\n'), 'utf-8')
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const required = ['ANTHROPIC_API_KEY', 'DATABASE_URL']
  for (const v of required) {
    if (!process.env[v]) {
      console.error(`[eval] Missing env: ${v}`)
      process.exit(1)
    }
  }

  const args = parseArgs()

  console.info(`[eval] kind=${args.kind} limit=${args.limit} → ${args.outPath}`)

  const samples = await fetchSamples(args.kind, args.limit)
  if (samples.length === 0) {
    console.error(
      `[eval] No filing_sections rows found with prompt_id LIKE '${args.kind}@%' AND length(text) > 1000.\n` +
        `       Run summarisation against this kind first (e.g. bun run scripts/summarize-all.ts), or pick a different --kind.`,
    )
    process.exit(2)
  }
  console.info(`[eval] Fetched ${samples.length} sample(s)`)

  const v1Prompt = V1_SECTION_PROMPTS[args.kind]
  const livePrompt = getLivePrompt(args.kind)

  if (v1Prompt.system === livePrompt.system) {
    console.info(
      `[eval] ⚠️  v1 and live system prompts are byte-identical — Phase 3 has not yet swapped this section. The eval will mostly show Claude's sampling variance.`,
    )
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const results: SampleResult[] = []
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    console.info(
      `[eval] [${i + 1}/${samples.length}] ${sample.companyName} (${sample.ticker}) — running v1 + live in parallel`,
    )
    const params: V1PromptParams = {
      section: sample.text,
      companyName: sample.companyName,
      filingType: sample.filingType,
    }
    const [v1, liveResult] = await Promise.all([
      runPrompt(client, v1Prompt.system, v1Prompt.user(params), v1Prompt.maxTokens),
      runPrompt(client, livePrompt.system, livePrompt.user(params), livePrompt.maxTokens),
    ])
    results.push({ sample, v1, liveResult })
  }

  await writeReport(args, results, livePrompt.system, v1Prompt.system)
  console.info(`[eval] ✓ Wrote report to ${args.outPath}`)
}

main().catch((err) => {
  console.error('[eval] Unhandled error:', err)
  process.exit(1)
})
