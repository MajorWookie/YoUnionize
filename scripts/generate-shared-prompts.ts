#!/usr/bin/env bun
/**
 * Mirror prompt files from packages/ai/src/prompts/ into
 * supabase/functions/_shared/prompts/ so Deno-runtime Edge Functions can
 * consume the same template that ClaudeClient (Bun) uses.
 *
 * Source-of-truth: packages/ai/src/prompts/<name>.ts
 * Mirror:          supabase/functions/_shared/prompts/<name>.ts
 *
 * Run on demand:   bun run prompts:generate
 * Verify in CI:    bun run prompts:check  (runs this with --check; fails if
 *                  the on-disk mirror is out of date relative to source).
 *
 * Why a mirror and not a direct cross-tree import: Supabase's Edge Function
 * deploy bundler walks the import graph from supabase/functions/. Files
 * outside that directory aren't reliably picked up. Keeping a committed
 * mirror inside _shared/ matches the pattern used by _shared/schema.ts and
 * removes any deploy-time uncertainty.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = resolve(REPO_ROOT, 'packages/ai/src/prompts')
const MIRROR_DIR = resolve(
  REPO_ROOT,
  'supabase/functions/_shared/prompts',
)

/**
 * Files to mirror. Other prompts in packages/ai/src/prompts/ stay Bun-only —
 * they are consumed only by ClaudeClient and never by an Edge Function.
 */
const SHARED_PROMPTS = [
  'rag-answer.ts',
  'what-this-means.ts',
  'compensation-analysis.ts',
] as const

const BANNER = `// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED — DO NOT EDIT
//
// Mirror of packages/ai/src/prompts/<name>.ts produced by
// scripts/generate-shared-prompts.ts. Edit the source file, then run:
//
//   bun run prompts:generate
//
// CI fails if this file drifts from the source.
// ─────────────────────────────────────────────────────────────────────────────

`

function mirrorContent(sourceText: string): string {
  return BANNER + sourceText
}

function main(): void {
  const checkOnly = process.argv.includes('--check')

  if (!existsSync(MIRROR_DIR)) {
    if (checkOnly) {
      console.error(
        `[prompts] mirror dir missing: ${MIRROR_DIR}\nRun \`bun run prompts:generate\`.`,
      )
      process.exit(1)
    }
    mkdirSync(MIRROR_DIR, { recursive: true })
  }

  const drifted: Array<string> = []

  for (const filename of SHARED_PROMPTS) {
    const sourcePath = resolve(SOURCE_DIR, filename)
    const mirrorPath = resolve(MIRROR_DIR, filename)

    const sourceText = readFileSync(sourcePath, 'utf8')
    const expected = mirrorContent(sourceText)

    if (checkOnly) {
      const actual = existsSync(mirrorPath) ? readFileSync(mirrorPath, 'utf8') : ''
      if (actual !== expected) {
        drifted.push(filename)
      }
      continue
    }

    writeFileSync(mirrorPath, expected, 'utf8')
    console.info(`[prompts] wrote ${mirrorPath}`)
  }

  if (checkOnly) {
    if (drifted.length > 0) {
      console.error(
        `[prompts] mirror out of date for:\n  ${drifted.join('\n  ')}\nRun \`bun run prompts:generate\` and commit the result.`,
      )
      process.exit(1)
    }
    console.info('[prompts] mirror is up to date')
  }
}

main()
