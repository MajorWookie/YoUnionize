// ─────────────────────────────────────────────────────────────────────────────
// Deno-compatible mirror of packages/ai/src/extract-json.ts.
//
// The Bun-side ClaudeClient uses `extractJson()` to robustly parse Claude's
// JSON responses (Claude often wraps JSON in ```json ... ``` fences or adds
// a prose preamble despite the prompt's "JSON only" instruction). Edge
// Functions can't import from packages/ai (Deno can't load Bun workspaces),
// so this file is a verbatim port. Keep the two implementations in sync —
// any change to fence/prose handling here must mirror packages/ai/src/
// extract-json.ts and vice versa.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse JSON from a Claude response, handling markdown fences and prose wrapping.
 * Tries direct parse first, then extracts the first JSON object/array from the text.
 */
export function extractJson<T>(text: string): T {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')

  // Happy path: direct parse
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fall through to extraction
  }

  // Find first JSON object or array delimiter
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
  console.info(`[extractJson] stripped ${startIndex} leading chars from prose response`)
  return JSON.parse(extracted) as T
}
