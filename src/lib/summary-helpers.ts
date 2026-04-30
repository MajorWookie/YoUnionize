/**
 * Type-narrowing helpers for extracting AI summary fields out of the
 * loosely-typed `summary` blob returned on each headline filing. Each
 * key's value is either undefined, a string (most prompts), or a
 * structured object (employee_impact, executive_summary). These
 * helpers keep the type narrowing at the data boundary so the UI can
 * stay declarative.
 *
 * Source-of-truth note (post-2026-04-29 per-section rewrite):
 *   - Filing-level rollups (executive_summary, employee_impact, the
 *     four XBRL statements) live on `filing_summaries.ai_summary`.
 *   - Per-item summaries (mda, risk_factors, business_overview,
 *     legal_proceedings, footnotes, cybersecurity, etc.) live on
 *     `filing_sections.ai_summary`.
 *   - The `company-detail` Edge Function merges both into the single
 *     `summary` field so this layer stays unchanged. The
 *     `financial_footnotes` prompt kind is mapped to `footnotes` for
 *     backward compat with the legacy rollup-blob key.
 */

export interface EmployeeImpactResult {
  overall_outlook: string
  job_security: string
  compensation_signals: string
  growth_opportunities: string
  workforce_geography: string
  h1b_and_visa_dependency: string
  watch_items: Array<string>
}

export function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function asEmployeeImpact(
  value: unknown,
): EmployeeImpactResult | undefined {
  if (!value || typeof value !== 'object') return undefined
  const obj = value as Record<string, unknown>
  // Loose discriminator: any of the canonical fields present as a string.
  const hasShape =
    typeof obj.overall_outlook === 'string' ||
    typeof obj.job_security === 'string' ||
    typeof obj.compensation_signals === 'string'
  return hasShape ? (obj as unknown as EmployeeImpactResult) : undefined
}

/**
 * Format an EmployeeImpactResult into a markdown string ready for
 * MarkdownContent. Mirrors the formatter used in the iOS app so the two
 * platforms render the same content.
 */
export function formatEmployeeImpact(impact: EmployeeImpactResult): string {
  const parts: Array<string> = []
  if (impact.overall_outlook) parts.push(`**${impact.overall_outlook}**`)
  if (impact.job_security)
    parts.push(`## Job Security\n${impact.job_security}`)
  if (impact.compensation_signals)
    parts.push(`## Compensation & Benefits\n${impact.compensation_signals}`)
  if (impact.growth_opportunities)
    parts.push(`## Growth Opportunities\n${impact.growth_opportunities}`)
  if (impact.workforce_geography)
    parts.push(
      `## Workforce & Revenue Geography\n${impact.workforce_geography}`,
    )
  if (impact.h1b_and_visa_dependency)
    parts.push(`## H-1B & Visa Dependency\n${impact.h1b_and_visa_dependency}`)
  if (impact.watch_items?.length > 0) {
    parts.push(
      `## Watch Items\n${impact.watch_items.map((item) => `- ${item}`).join('\n')}`,
    )
  }
  return parts.join('\n\n')
}
