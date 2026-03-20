/**
 * Normalize a person's name for deduplication.
 * Lowercase, trim whitespace, strip honorific suffixes (Jr., Sr., II, III, etc.).
 */

const SUFFIX_PATTERN = /\s*,?\s*(Jr\.?|Sr\.?|II|III|IV|V|Esq\.?|Ph\.?D\.?|M\.?D\.?|CPA)\s*$/i

export function normalizeName(name: string): string {
  return name.trim().replace(SUFFIX_PATTERN, '').trim().toLowerCase()
}
