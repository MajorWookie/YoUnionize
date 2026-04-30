/**
 * Type-narrowing helpers for extracting AI summary fields out of the
 * loosely-typed `filing_summaries.ai_summary` record. Each section's value
 * is either undefined, a string (most prompts), or a structured object
 * (employee_impact, executive_summary). These helpers keep the type
 * narrowing at the data boundary so the UI can stay declarative.
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

// Sentinel written by the backend's mergeEmployeeImpact when one of the two
// source prompts (employee-outlook or workforce-signals) failed. Render this
// as "absent" rather than verbatim — the user shouldn't see internal jargon.
const NOT_ANALYSED_SENTINEL = 'Not analysed for this filing.'

function present(value: string | undefined): boolean {
  return !!value && value.trim().length > 0 && value !== NOT_ANALYSED_SENTINEL
}

/**
 * Format an EmployeeImpactResult into a markdown string ready for
 * MarkdownContent. Sections whose source prompt failed (sentinel-valued)
 * are dropped silently; an entirely-failed analysis returns an empty
 * string so the caller can show its own empty-state.
 */
export function formatEmployeeImpact(impact: EmployeeImpactResult): string {
  const parts: Array<string> = []
  if (present(impact.overall_outlook)) parts.push(`**${impact.overall_outlook}**`)
  if (present(impact.job_security))
    parts.push(`## Job Security\n${impact.job_security}`)
  if (present(impact.compensation_signals))
    parts.push(`## Compensation & Benefits\n${impact.compensation_signals}`)
  if (present(impact.growth_opportunities))
    parts.push(`## Growth Opportunities\n${impact.growth_opportunities}`)
  if (present(impact.workforce_geography))
    parts.push(
      `## Workforce & Revenue Geography\n${impact.workforce_geography}`,
    )
  if (present(impact.h1b_and_visa_dependency))
    parts.push(`## H-1B & Visa Dependency\n${impact.h1b_and_visa_dependency}`)
  if (impact.watch_items?.length > 0) {
    parts.push(
      `## Watch Items\n${impact.watch_items.map((item) => `- ${item}`).join('\n')}`,
    )
  }
  return parts.join('\n\n')
}
