import { eq, isNull, and } from 'drizzle-orm'
import { getDb, directors } from '@younionize/postgres'
import { getCanonicalFirstName } from '@younionize/helpers'
import {
  extractLastName,
  pickCanonical,
  positionsOverlap,
} from './compensation-name-enrichment'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnrichResult {
  merged: number
  skipped: number
}

interface DirRow {
  id: string
  name: string
  title: string
}

// ─── Grouping ───────────────────────────────────────────────────────────────

/**
 * Group director records by likely same-person clusters.
 * Uses last-name matching + nickname-aware first-name matching + position overlap.
 *
 * Returns Map<canonicalName, rowIds[]>
 */
export function groupDirectorsByPerson(
  rows: Array<DirRow>,
): Map<string, Array<string>> {
  // Group by last name first
  const byLastName = new Map<string, Array<DirRow>>()
  for (const row of rows) {
    const lastName = extractLastName(row.name)
    if (!lastName) continue
    const group = byLastName.get(lastName) ?? []
    group.push(row)
    byLastName.set(lastName, group)
  }

  const result = new Map<string, Array<string>>()

  for (const sameLastName of byLastName.values()) {
    // Sub-group by first-name similarity + position overlap
    const subGroups: Array<Array<DirRow>> = []

    for (const row of sameLastName) {
      let placed = false
      const rowFirstName = extractFirstName(row.name)

      for (const sg of subGroups) {
        const memberFirstName = extractFirstName(sg[0]!.name)

        // Check first-name match (nickname-aware) AND position overlap
        const firstNamesMatch = getCanonicalFirstName(rowFirstName) === getCanonicalFirstName(memberFirstName)
        const posMatch = sg.some((member) => positionsOverlap(member.title, row.title))

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
      const canonical = pickCanonical(sg.map((r) => r.name))
      const ids = sg.map((r) => r.id)
      result.set(canonical, ids)
    }
  }

  return result
}

/**
 * Extract the first name token from a full name, lowercased, with suffixes stripped.
 */
function extractFirstName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0] ?? '').toLowerCase()
}

// ─── Main Enrichment Function ───────────────────────────────────────────────

/**
 * Enrich director records with canonical names.
 * Groups name variants by last name + nickname-aware first-name matching +
 * position overlap, then picks the most common name as canonical.
 *
 * Idempotent: skips rows with existing canonical_name unless force=true.
 */
export async function enrichDirectorNames(
  companyId: string,
  options?: { force?: boolean },
): Promise<EnrichResult> {
  const db = getDb()

  const whereClause = options?.force
    ? eq(directors.companyId, companyId)
    : and(
      eq(directors.companyId, companyId),
      isNull(directors.canonicalName),
    )

  const rows = await db
    .select({
      id: directors.id,
      name: directors.name,
      title: directors.title,
    })
    .from(directors)
    .where(whereClause)

  if (rows.length === 0) return { merged: 0, skipped: 0 }

  const groups = groupDirectorsByPerson(rows)

  let merged = 0
  let skipped = 0

  for (const [canonical, ids] of groups) {
    const distinctNames = new Set(
      rows.filter((r) => ids.includes(r.id)).map((r) => r.name),
    )
    if (distinctNames.size > 1) {
      const variants = [...distinctNames].filter((n) => n !== canonical)
      console.info(
        `[Enrichment] Merged director names ${variants.map((v) => `"${v}"`).join(', ')} → "${canonical}" for company ${companyId}`,
      )
      merged += variants.length
    }

    for (const id of ids) {
      await db
        .update(directors)
        .set({ canonicalName: canonical })
        .where(eq(directors.id, id))
    }

    skipped += ids.length
  }

  return { merged, skipped: skipped - merged }
}
