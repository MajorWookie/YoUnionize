// ─────────────────────────────────────────────────────────────────────────────
// Hand-mirror of packages/ai/src/extract-json.ts.
//
// Edge Functions run on Deno and cannot import Bun-side workspace packages,
// so this helper is duplicated here. Keep it in sync with the source — both
// are tiny and stable, but a divergence would silently regress
// /api/analysis/compensation-fairness back to its old "persist a junk row
// when Claude wraps JSON in markdown fences" behavior.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse JSON from a Claude response, handling markdown fences and prose wrapping.
 * Tries direct parse first, then extracts the first JSON object/array from the text.
 */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')

  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fall through to extraction
  }

  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')

  let startIndex: number
  let endChar: string

  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error(`No JSON found in response: ${cleaned.slice(0, 80)}...`)
  } else if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
    startIndex = firstBrace
    endChar = '}'
  } else {
    startIndex = firstBracket
    endChar = ']'
  }

  const lastEnd = cleaned.lastIndexOf(endChar)
  if (lastEnd <= startIndex) {
    throw new Error(`Malformed JSON in response: ${cleaned.slice(0, 80)}...`)
  }

  const extracted = cleaned.slice(startIndex, lastEnd + 1)
  console.info(`[extractJson] Extracted JSON from prose response (stripped ${startIndex} leading chars)`)
  return JSON.parse(extracted) as T
}
