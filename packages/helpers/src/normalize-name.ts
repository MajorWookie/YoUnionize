/**
 * Normalize a person's name for deduplication.
 *
 * Steps: trim → strip honorific suffixes → collapse whitespace →
 *        strip middle initials (single-letter tokens not first/last) → lowercase.
 *
 * Keep this logic in sync with:
 *   - supabase/functions/_shared/sec-ingest.ts  (Deno copy)
 *   - supabase/migrations/20260323000001_enhanced_name_dedup.sql  (PL/pgSQL copy)
 */

const SUFFIX_PATTERN = /\s*,?\s*(Jr\.?|Sr\.?|II|III|IV|V|Esq\.?|Ph\.?D\.?|M\.?D\.?|CPA)\s*$/i

/**
 * Returns true if a token is a single-letter initial (optionally followed by a period).
 * Examples: "D.", "D", "J.", "A"
 */
function isInitial(token: string): boolean {
  return /^[A-Za-z]\.?$/.test(token)
}

export function normalizeName(name: string): string {
  // 1. Trim + strip suffixes
  let cleaned = name.trim().replace(SUFFIX_PATTERN, '').trim()

  // 2. Collapse multiple spaces to single space
  cleaned = cleaned.replace(/\s+/g, ' ')

  // 3. Strip middle initials (single-letter tokens not in first or last position)
  const tokens = cleaned.split(' ')
  if (tokens.length > 2) {
    const filtered = [tokens[0]!]
    for (let i = 1; i < tokens.length - 1; i++) {
      if (!isInitial(tokens[i]!)) {
        filtered.push(tokens[i]!)
      }
    }
    filtered.push(tokens[tokens.length - 1]!)
    cleaned = filtered.join(' ')
  }

  // 4. Lowercase
  return cleaned.toLowerCase()
}
