import { eq, isNull, and } from 'drizzle-orm'
import { getDb, directors } from '@younionize/postgres'

// ─── Types ──────────────────────────────────────────────────────────────────

type DirectorRole = 'director' | 'officer' | 'both'

interface EnrichResult {
  classified: number
  ambiguous: number
}

interface DirectorRow {
  id: string
  title: string
  isIndependent: boolean | null
  directorClass: string | null
  committees: unknown
}

// ─── Officer Keyword Patterns ───────────────────────────────────────────────

// Word-boundary regex patterns to avoid false positives
// (e.g., "Director" must NOT match "cto")
const OFFICER_PATTERNS: Array<RegExp> = [
  /\bchief executive/i, /\bceo\b/i,
  /\bchief financial/i, /\bcfo\b/i,
  /\bchief operating/i, /\bcoo\b/i,
  /\bchief technology/i, /\bcto\b/i,
  /\bchief information/i, /\bcio\b/i,
  /\bchief legal/i, /\bclo\b/i,
  /\bchief marketing/i, /\bcmo\b/i,
  /\bchief human resources/i, /\bchro\b/i,
  /\bgeneral counsel/i,
  /\bsenior vice president/i, /\bsvp\b/i,
  /\bexecutive vice president/i, /\bevp\b/i,
  // "President, IHOP" or "President of Digital" but not "Former President" alone
  /\bpresident[,\s]+(?:of\s+)?[a-z]/i,
]

/**
 * Check if a position string contains officer-level keywords.
 */
function hasOfficerKeywords(position: string): boolean {
  return OFFICER_PATTERNS.some((re) => re.test(position))
}

/**
 * Check if a director row has signals indicating board membership.
 */
function hasDirectorSignals(row: DirectorRow): boolean {
  if (row.isIndependent !== null) return true
  if (row.directorClass && row.directorClass.trim().length > 0) return true
  const committees = row.committees as Array<string> | null
  if (committees && committees.length > 0) return true
  return false
}

/**
 * Classify a director/officer record into a role based on available signals.
 *
 * Rules (priority order, first match wins):
 * 1. isIndependent is true/false (not null) → 'director'
 * 2. directorClass is non-empty → 'director'
 * 3. Officer keywords + director signals → 'both'
 * 4. Officer keywords + no director signals → 'officer'
 * 5. "Executive Chairman" or "Chairman of the Board" → 'both'
 * 6. "Director" or "Chair" without officer keywords → 'director'
 * 7. None → null (ambiguous)
 */
export function classifyRole(row: DirectorRow): DirectorRole | null {
  const lower = row.title.toLowerCase()
  const isOfficer = hasOfficerKeywords(row.title)

  // Rule 1: isIndependent is a strong board-member signal
  if (row.isIndependent !== null && !isOfficer) return 'director'

  // Rule 2: directorClass is a strong board-member signal
  if (row.directorClass && row.directorClass.trim().length > 0 && !isOfficer) return 'director'

  // Rules 1+2 combined with officer keywords → 'both'
  if (isOfficer && (row.isIndependent !== null || (row.directorClass && row.directorClass.trim().length > 0))) {
    return 'both'
  }

  // Rule 3: Officer with other director signals (committees)
  if (isOfficer && hasDirectorSignals(row)) return 'both'

  // Rule 4: Pure officer
  if (isOfficer) return 'officer'

  // Rule 5: Executive Chairman / Chairman of the Board
  if (lower.includes('executive chairman') || lower.includes('chairman of the board')) {
    return 'both'
  }

  // Rule 6: Contains "Director" or "Chair" without officer keywords
  if (lower.includes('director') || lower.includes('chair')) return 'director'

  // Rule 7: Ambiguous — check remaining director signals
  if (hasDirectorSignals(row)) return 'director'

  return null
}

// ─── Main Enrichment Function ───────────────────────────────────────────────

/**
 * Enrich director records with role classification.
 * Applies heuristic rules based on position title, isIndependent,
 * directorClass, and committee memberships.
 *
 * Idempotent: skips rows with existing role unless force=true.
 */
export async function enrichDirectorRoles(
  companyId: string,
  options?: { force?: boolean },
): Promise<EnrichResult> {
  const db = getDb()

  const whereClause = options?.force
    ? eq(directors.companyId, companyId)
    : and(eq(directors.companyId, companyId), isNull(directors.role))

  const rows = await db
    .select({
      id: directors.id,
      title: directors.title,
      isIndependent: directors.isIndependent,
      directorClass: directors.directorClass,
      committees: directors.committees,
    })
    .from(directors)
    .where(whereClause)

  if (rows.length === 0) return { classified: 0, ambiguous: 0 }

  let classified = 0
  let ambiguous = 0

  for (const row of rows) {
    const role = classifyRole(row)

    if (role) {
      await db
        .update(directors)
        .set({ role })
        .where(eq(directors.id, row.id))
      console.info(`[Enrichment] Classified "${row.title}" as '${role}' for company ${companyId}`)
      classified++
    } else {
      console.info(`[Enrichment] WARN: Could not classify "${row.title}" for company ${companyId}`)
      ambiguous++
    }
  }

  return { classified, ambiguous }
}
