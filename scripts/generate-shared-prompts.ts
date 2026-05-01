#!/usr/bin/env bun
/**
 * Mirror Bun-side files into supabase/functions/_shared/ so Deno-runtime Edge
 * Functions can consume the same source-of-truth that ClaudeClient and other
 * Bun consumers use.
 *
 * Currently mirrored:
 *   - Cross-runtime prompts (packages/ai/src/prompts/<name>.ts)
 *   - extractJson helper    (packages/ai/src/extract-json.ts)
 *
 * Run on demand:   bun run prompts:generate
 * Verify in CI:    bun run prompts:check  (runs this with --check; fails if
 *                  any on-disk mirror is out of date relative to its source).
 *
 * Why a mirror and not a direct cross-tree import: Supabase's Edge Function
 * deploy bundler walks the import graph from supabase/functions/. Files
 * outside that directory aren't reliably picked up. Keeping a committed
 * mirror inside _shared/ matches the pattern used by _shared/schema.ts and
 * removes any deploy-time uncertainty.
 *
 * Adding a new shared file: append to SHARED_FILES below, run the script,
 * and commit both the new mirror and any banner-only updates to existing
 * mirrors that result.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

interface SharedFile {
  /** Repo-relative path to the source file (Bun-side, source of truth). */
  source: string
  /** Repo-relative path to the Deno-side mirror under supabase/functions/_shared/. */
  mirror: string
}

const SHARED_FILES: ReadonlyArray<SharedFile> = [
  {
    source: 'packages/ai/src/prompts/rag-answer.ts',
    mirror: 'supabase/functions/_shared/prompts/rag-answer.ts',
  },
  {
    source: 'packages/ai/src/prompts/what-this-means.ts',
    mirror: 'supabase/functions/_shared/prompts/what-this-means.ts',
  },
  {
    source: 'packages/ai/src/prompts/compensation-analysis.ts',
    mirror: 'supabase/functions/_shared/prompts/compensation-analysis.ts',
  },
  {
    source: 'packages/ai/src/extract-json.ts',
    mirror: 'supabase/functions/_shared/extract-json.ts',
  },
]

function bannerFor(sourceRelPath: string): string {
  return `// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED — DO NOT EDIT
//
// Mirror of ${sourceRelPath} produced by
// scripts/generate-shared-prompts.ts. Edit the source file, then run:
//
//   bun run prompts:generate
//
// CI fails if this file drifts from the source.
// ─────────────────────────────────────────────────────────────────────────────

`
}

function mirrorContent(sourceRelPath: string, sourceText: string): string {
  return bannerFor(sourceRelPath) + sourceText
}

function main(): void {
  const checkOnly = process.argv.includes('--check')
  const drifted: Array<string> = []

  for (const entry of SHARED_FILES) {
    const sourceAbs = resolve(REPO_ROOT, entry.source)
    const mirrorAbs = resolve(REPO_ROOT, entry.mirror)
    const mirrorDir = dirname(mirrorAbs)

    if (!existsSync(mirrorDir)) {
      if (checkOnly) {
        console.error(
          `[mirror] mirror dir missing: ${mirrorDir}\nRun \`bun run prompts:generate\`.`,
        )
        process.exit(1)
      }
      mkdirSync(mirrorDir, { recursive: true })
    }

    const sourceText = readFileSync(sourceAbs, 'utf8')
    const expected = mirrorContent(entry.source, sourceText)

    if (checkOnly) {
      const actual = existsSync(mirrorAbs) ? readFileSync(mirrorAbs, 'utf8') : ''
      if (actual !== expected) {
        drifted.push(entry.mirror)
      }
      continue
    }

    writeFileSync(mirrorAbs, expected, 'utf8')
    console.info(`[mirror] wrote ${entry.mirror}`)
  }

  if (checkOnly) {
    if (drifted.length > 0) {
      console.error(
        `[mirror] out of date:\n  ${drifted.join('\n  ')}\nRun \`bun run prompts:generate\` and commit the result.`,
      )
      process.exit(1)
    }
    console.info('[mirror] all mirrors up to date')
  }
}

main()
