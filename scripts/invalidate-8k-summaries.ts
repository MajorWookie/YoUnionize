#!/usr/bin/env bun
/**
 * One-time invalidation: mark every `filing_sections` row produced by an
 * older `event_8k` prompt version as pending re-summarisation.
 *
 * Why we need this:
 *   - The new prompt (`event_8k@v3`) emits `{ headline, summary }` JSON
 *     instead of a single markdown paragraph.
 *   - The Edge Function `loadRecentEightKItems` (supabase/functions/
 *     company-detail/index.ts) reads `aiSummary.headline` and
 *     `aiSummary.summary` and falls back to the raw string when the
 *     stored row is in the v2 shape — the feed renders something
 *     readable, but with no headline. Re-summarising backfills the
 *     headlines.
 *
 * What this script does:
 *   - Counts filing_sections rows whose prompt_id is an `event_8k@…`
 *     value other than the current `PROMPT_VERSIONS.event_8k`.
 *   - Sets `summary_version = -1` so the next summarisation run picks
 *     them up via the `filing_sections_pending_summarize_idx` partial
 *     index. ai_summary is left in place as a fallback for the feed
 *     until re-summarisation lands the new shape.
 *
 * Usage:
 *   # dry run (default — shows counts, writes nothing)
 *   bun run scripts/invalidate-8k-summaries.ts
 *
 *   # actually mark stale rows
 *   bun run scripts/invalidate-8k-summaries.ts --apply
 *
 *   # against the remote DB (recommended path for this repo)
 *   bunx dotenvx run -f .env.remote -- \
 *     bun run scripts/invalidate-8k-summaries.ts --apply
 *
 * Requires DATABASE_URL.
 */

import { sql } from 'drizzle-orm'
import { getDb } from '@younionize/postgres'
import { PROMPT_VERSIONS } from '@younionize/sec-api'

const APPLY = process.argv.includes('--apply')
const CURRENT = PROMPT_VERSIONS.event_8k

async function main(): Promise<void> {
  const db = getDb()

  const [{ stale }] = (await db.execute(sql`
    SELECT COUNT(*)::int AS stale
    FROM filing_sections
    WHERE prompt_id LIKE 'event_8k@%'
      AND prompt_id <> ${CURRENT}
  `)) as Array<{ stale: number }>

  // The pipeline's resumability gate selects filings by
  // `filing_summaries.summary_version`, so marking only filing_sections
  // stale leaves them stranded. Count parent 8-K filings that need the
  // version flip too.
  const [{ filings }] = (await db.execute(sql`
    SELECT COUNT(DISTINCT fs.filing_id)::int AS filings
    FROM filing_sections fs
    INNER JOIN filing_summaries f ON f.id = fs.filing_id
    WHERE fs.prompt_id LIKE 'event_8k@%'
      AND fs.prompt_id <> ${CURRENT}
      AND f.filing_type = '8-K'
      AND f.summary_version <> 0
  `)) as Array<{ filings: number }>

  console.info(`[invalidate-8k] current prompt version: ${CURRENT}`)
  console.info(`[invalidate-8k] stale event_8k section rows: ${stale}`)
  console.info(`[invalidate-8k] parent 8-K filings to reopen: ${filings}`)

  if (stale === 0 && filings === 0) {
    console.info('[invalidate-8k] nothing to do.')
    return
  }

  if (!APPLY) {
    console.info(
      `[invalidate-8k] DRY RUN — pass --apply to mark ${stale} sections + reopen ${filings} parent filings for re-summarisation.`,
    )
    return
  }

  // Two updates in a single transaction so a failure mid-way doesn't leave
  // the DB partially flipped.
  const result = await db.transaction(async (tx) => {
    const sections = await tx.execute(sql`
      UPDATE filing_sections
      SET summary_version = -1,
          summarization_updated_at = now()
      WHERE prompt_id LIKE 'event_8k@%'
        AND prompt_id <> ${CURRENT}
      RETURNING id
    `)

    const reopened = await tx.execute(sql`
      UPDATE filing_summaries
      SET summary_version = 0,
          updated_at = now()
      WHERE filing_type = '8-K'
        AND id IN (
          SELECT DISTINCT filing_id
          FROM filing_sections
          WHERE prompt_id LIKE 'event_8k@%'
            AND prompt_id <> ${CURRENT}
        )
        AND summary_version <> 0
      RETURNING id
    `)

    return {
      sections: (sections as Array<unknown>).length,
      reopened: (reopened as Array<unknown>).length,
    }
  })

  console.info(
    `[invalidate-8k] marked ${result.sections} sections stale and reopened ${result.reopened} parent 8-K filings.`,
  )
  console.info(
    '[invalidate-8k] re-run summarisation (e.g. `bun run scripts/seed-companies.ts --tickers=ORCL`) to populate the new {headline, summary} shape.',
  )
}

main().catch((err) => {
  console.error('[invalidate-8k] failed:', err)
  process.exit(1)
})
