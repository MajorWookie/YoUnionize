#!/usr/bin/env bun
/**
 * One-time invalidation: clear `compensation_analyses` rows that were saved
 * under the broken 1–10 / `summary`/`detailed_analysis`/`key_findings` schema.
 *
 * Why we cannot keep them:
 *   - The frontend's AnalysisData interface (src/routes/my-pay.tsx:33-43)
 *     reads `analysis.explanation` and `analysis.comparisons` — undefined
 *     in 1–10 rows. The page crashes on `analysis.comparisons.length`.
 *   - `fairness_score` from old rows is on a 1–10 scale; FairnessGauge
 *     thresholds (80/60/40) interpret 7 as "Underpaid".
 *   - There is no clean conversion: the LLM's 1–10 ratings weren't
 *     calibrated to our 1–100 bands, and the old `summary`+`detailed_analysis`
 *     fields don't map cleanly to `explanation`+`comparisons`.
 *
 * What this script does:
 *   - Counts rows that look like the broken schema (missing `explanation` OR
 *     `comparisons`, or fairness_score ≤ 10).
 *   - Deletes them. New POSTs through /api/analysis/compensation-fairness
 *     will regenerate cleanly under the 1–100 contract.
 *
 * Usage:
 *   # dry run (default — shows counts, deletes nothing)
 *   bun run scripts/invalidate-compensation-analyses.ts
 *
 *   # actually delete
 *   bun run scripts/invalidate-compensation-analyses.ts --apply
 *
 *   # against the remote DB (recommended path for this repo)
 *   bunx dotenvx run -f .env.remote -- \
 *     bun run scripts/invalidate-compensation-analyses.ts --apply
 *
 * Requires DATABASE_URL.
 */

import { sql } from 'drizzle-orm'
import { getDb, compensationAnalyses } from '@younionize/postgres'

const APPLY = process.argv.includes('--apply')

async function main(): Promise<void> {
  const db = getDb()

  // Total rows
  const [{ total }] = (await db.execute(
    sql`SELECT COUNT(*)::int AS total FROM compensation_analyses`,
  )) as Array<{ total: number }>

  // Rows missing the 1–100 contract: either no `explanation` key, no
  // `comparisons` key, or fairness_score in the 1–10 band. Belt-and-braces:
  // any of those signals identifies a stale row.
  const [{ stale }] = (await db.execute(sql`
    SELECT COUNT(*)::int AS stale
    FROM compensation_analyses
    WHERE
      analysis_data->>'explanation' IS NULL
      OR analysis_data->'comparisons' IS NULL
      OR (analysis_data->>'fairness_score')::numeric <= 10
  `)) as Array<{ stale: number }>

  console.info(`[invalidate] compensation_analyses total rows: ${total}`)
  console.info(`[invalidate] stale rows (1–10 schema or missing fields): ${stale}`)

  if (stale === 0) {
    console.info('[invalidate] nothing to do.')
    return
  }

  if (!APPLY) {
    console.info(
      `[invalidate] DRY RUN — pass --apply to delete ${stale} stale rows.`,
    )
    return
  }

  const deleted = await db.delete(compensationAnalyses)
    .where(sql`
      analysis_data->>'explanation' IS NULL
      OR analysis_data->'comparisons' IS NULL
      OR (analysis_data->>'fairness_score')::numeric <= 10
    `)
    .returning({ id: compensationAnalyses.id })

  console.info(`[invalidate] deleted ${deleted.length} rows.`)
  console.info(
    '[invalidate] users will see an empty My Pay page until they click Refresh Analysis.',
  )
}

main().catch((err) => {
  console.error('[invalidate] failed:', err)
  process.exit(1)
})
