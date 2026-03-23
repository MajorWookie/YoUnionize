import { eq, isNull, and } from 'drizzle-orm'
import { getDb, executiveCompensation } from '@union/postgres'
import { getCanonicalFirstName } from '@union/helpers'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnrichResult {
  merged: number
  skipped: number
}

interface CompRow {
  id: string
  executiveName: string
  title: string
}

// ─── Name Suffix Patterns ───────────────────────────────────────────────────

const NAME_SUFFIXES = /\s+(jr\.?|sr\.?|iii|ii|iv|esq\.?|ph\.?d\.?)$/i

// ─── Position Role Groups ───────────────────────────────────────────────────
// Each group represents synonymous titles. Two positions "overlap" if they
// share any group. Using role groups avoids the problem where "CEO" and
// "Chief Executive Officer" extract to different keyword strings.

const ROLE_GROUPS: Array<{ id: string; patterns: Array<RegExp> }> = [
  { id: 'ceo', patterns: [/\bceo\b/i, /\bchief executive/i] },
  { id: 'cfo', patterns: [/\bcfo\b/i, /\bchief financial/i] },
  { id: 'coo', patterns: [/\bcoo\b/i, /\bchief operating/i] },
  { id: 'cto', patterns: [/\bcto\b/i, /\bchief technology/i] },
  { id: 'cio', patterns: [/\bcio\b/i, /\bchief information/i] },
  { id: 'gc', patterns: [/\bgeneral counsel/i, /\bclo\b/i, /\bchief legal/i] },
  { id: 'svp', patterns: [/\bsvp\b/i, /\bsenior vice president/i] },
  { id: 'evp', patterns: [/\bevp\b/i, /\bexecutive vice president/i] },
  { id: 'president', patterns: [/\bpresident\b/i] },
  { id: 'treasurer', patterns: [/\btreasurer\b/i] },
  { id: 'secretary', patterns: [/\bsecretary\b/i] },
  { id: 'controller', patterns: [/\bcontroller\b/i] },
]

/**
 * Extract the last name from a full name, lowercased, with suffixes stripped.
 *
 * "Timothy D. Cook" → "cook"
 * "D. Bruce Sewell" → "sewell"
 * "Kevin Reilly Jr." → "reilly"
 */
export function extractLastName(name: string): string {
  const cleaned = name.trim().replace(NAME_SUFFIXES, '')
  const parts = cleaned.split(/\s+/)
  return (parts[parts.length - 1] ?? '').toLowerCase()
}

/**
 * Extract the first name from a full name, lowercased.
 *
 * "Timothy D. Cook" → "timothy"
 * "D. Bruce Sewell" → "d."
 */
export function extractFirstName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0] ?? '').toLowerCase()
}

/**
 * Extract role group IDs from a position string.
 * Uses word-boundary regex to avoid false positives (e.g., "Director" matching "cto").
 *
 * "Chief Executive Officer" → ["ceo"]
 * "Senior Vice President, CFO" → ["cfo", "svp", "president"]
 */
export function extractPositionKeywords(position: string): Array<string> {
  const matched: Array<string> = []
  for (const group of ROLE_GROUPS) {
    if (group.patterns.some((re) => re.test(position))) {
      matched.push(group.id)
    }
  }
  return matched
}

/**
 * Check if two position strings share any role group.
 * Returns true if either position is empty (can't distinguish — safer to allow merge).
 */
export function positionsOverlap(posA: string, posB: string): boolean {
  if (!posA.trim() || !posB.trim()) return true

  const groupsA = extractPositionKeywords(posA)
  const groupsB = extractPositionKeywords(posB)

  // If neither has recognized roles, they could be the same role
  if (groupsA.length === 0 && groupsB.length === 0) return true

  // If one has roles and the other doesn't, allow merge (ambiguous)
  if (groupsA.length === 0 || groupsB.length === 0) return true

  return groupsA.some((g) => groupsB.includes(g))
}

/**
 * Given a list of name variants, pick the canonical form:
 * 1. Most frequently occurring name
 * 2. Tiebreak: shortest name (informal variant tends to be the "known" name)
 */
export function pickCanonical(names: Array<string>): string {
  const freq = new Map<string, number>()
  for (const n of names) {
    freq.set(n, (freq.get(n) ?? 0) + 1)
  }

  let best = names[0]!
  let bestCount = freq.get(best)!

  for (const [name, count] of freq) {
    if (count > bestCount || (count === bestCount && name.length < best.length)) {
      best = name
      bestCount = count
    }
  }

  return best
}

/**
 * Group compensation records by likely same-person clusters.
 * Uses last-name matching + position-keyword overlap to avoid false merges.
 *
 * Returns Map<canonicalName, rowIds[]>
 */
export function groupByPerson(
  rows: Array<CompRow>,
): Map<string, Array<string>> {
  // Group by last name first
  const byLastName = new Map<string, Array<CompRow>>()
  for (const row of rows) {
    const lastName = extractLastName(row.executiveName)
    if (!lastName) continue
    const group = byLastName.get(lastName) ?? []
    group.push(row)
    byLastName.set(lastName, group)
  }

  const result = new Map<string, Array<string>>()

  for (const sameLastName of byLastName.values()) {
    // Sub-group by nickname-aware first-name matching + position overlap
    const subGroups: Array<Array<CompRow>> = []

    for (const row of sameLastName) {
      let placed = false
      const rowFirstName = extractFirstName(row.executiveName)

      for (const sg of subGroups) {
        const memberFirstName = extractFirstName(sg[0]!.executiveName)

        // Nickname-aware first-name comparison (Tim ↔ Timothy)
        const firstNamesMatch = getCanonicalFirstName(rowFirstName) === getCanonicalFirstName(memberFirstName)

        // Position overlap check (original behavior — preserved)
        const posMatch = sg.some((member) => positionsOverlap(member.title, row.title))

        // Merge if positions overlap (original) OR first names resolve to the same canonical
        if (firstNamesMatch || posMatch) {
          sg.push(row)
          placed = true
          break
        }
      }
      if (!placed) {
        subGroups.push([row])
      }
    }

    // For each sub-group, pick canonical and map row IDs
    for (const sg of subGroups) {
      const canonical = pickCanonical(sg.map((r) => r.executiveName))
      const ids = sg.map((r) => r.id)
      result.set(canonical, ids)
    }
  }

  return result
}

// ─── Main Enrichment Function ───────────────────────────────────────────────

/**
 * Enrich executive compensation records with canonical names.
 * Groups name variants by last name + position overlap, then picks the
 * most common name as canonical.
 *
 * Idempotent: skips rows with existing canonical_name unless force=true.
 */
export async function enrichCompensationNames(
  companyId: string,
  options?: { force?: boolean },
): Promise<EnrichResult> {
  const db = getDb()

  const whereClause = options?.force
    ? eq(executiveCompensation.companyId, companyId)
    : and(
        eq(executiveCompensation.companyId, companyId),
        isNull(executiveCompensation.canonicalName),
      )

  const rows = await db
    .select({
      id: executiveCompensation.id,
      executiveName: executiveCompensation.executiveName,
      title: executiveCompensation.title,
    })
    .from(executiveCompensation)
    .where(whereClause)

  if (rows.length === 0) return { merged: 0, skipped: 0 }

  const groups = groupByPerson(rows)

  let merged = 0
  let skipped = 0

  for (const [canonical, ids] of groups) {
    // Log merges where multiple distinct names exist
    const distinctNames = new Set(
      rows.filter((r) => ids.includes(r.id)).map((r) => r.executiveName),
    )
    if (distinctNames.size > 1) {
      const variants = [...distinctNames].filter((n) => n !== canonical)
      console.info(
        `[Enrichment] Merged ${variants.map((v) => `"${v}"`).join(', ')} → "${canonical}" for company ${companyId}`,
      )
      merged += variants.length
    }

    for (const id of ids) {
      await db
        .update(executiveCompensation)
        .set({ canonicalName: canonical })
        .where(eq(executiveCompensation.id, id))
    }

    skipped += ids.length
  }

  return { merged, skipped: skipped - merged }
}
