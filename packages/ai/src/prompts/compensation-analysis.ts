// ─────────────────────────────────────────────────────────────────────────────
// Compensation fairness prompt. Source-of-truth lives here; a verbatim copy is
// generated into supabase/functions/_shared/prompts/compensation-analysis.ts
// by scripts/generate-shared-prompts.ts so the Deno-runtime
// /api/analysis/compensation-fairness Edge Function can consume it.
//
// Edit this file, then run: bun run prompts:generate
// ─────────────────────────────────────────────────────────────────────────────
//
// Scale: 1–100, with banded scoring guidance.
//
// The frontend's AnalysisData contract (src/routes/my-pay.tsx) and
// FairnessGauge thresholds (80/60/40) require this shape. A previous
// production deploy briefly emitted a 1–10 scale with
// `summary`/`detailed_analysis`/`key_findings` fields; that broke
// `analysis.comparisons.length` reads on the My Pay page (undefined.length)
// and rendered the gauge as a tiny red ring labeled "Underpaid" regardless
// of input. Saved rows from that period are unsalvageable — see
// scripts/invalidate-compensation-analyses.ts.
// ─────────────────────────────────────────────────────────────────────────────

export interface CompensationAnalysisParams {
  /** User's gross annual pay in **raw dollars** — matches `user_profiles.gross_annual_pay`, which the web app stores in dollars (see CLAUDE.md "Currency convention"). */
  userPayDollars: number
  userJobTitle?: string | null
  companyName: string
  companyTicker: string
  companySector?: string | null
  /** Top executives by total comp — JSON-stringified inside the builder. */
  execComp: Array<Record<string, unknown>>
  /** Optional company financial highlights (key_numbers, employee_relevance). */
  companyFinancials: Record<string, unknown>
  /** Optional monthly cost-of-living breakdown (values in cents). */
  costOfLiving: Record<string, number | null>
}

export interface CompensationComparison {
  label: string
  insight: string
}

export interface CompensationFairnessResult {
  /** 1–100 fairness score. Bands: 80–100 fair, 60–79 some concerns, 40–59 notable, 20–39 significant, 1–19 extreme. */
  fairness_score: number
  explanation: string
  comparisons: Array<CompensationComparison>
  recommendations: Array<string>
}

export function compensationAnalysisSystemPrompt(): string {
  return `You are a compensation fairness analyst who helps regular employees understand how their pay compares to executive compensation at their company.

Your tone is supportive and empowering — not preachy or angry. You present facts clearly and help people make informed decisions.

You MUST respond with valid JSON matching this exact structure:
{
  "fairness_score": <number 1-100>,
  "explanation": "A 2-3 paragraph plain-language explanation of the pay landscape at this company",
  "comparisons": [
    {
      "label": "short comparison name",
      "insight": "what this comparison reveals"
    }
  ],
  "recommendations": ["actionable advice for the employee"]
}

Scoring guide:
- 80-100: Pay appears fair relative to exec comp and industry norms
- 60-79: Some concerns but within common ranges
- 40-59: Notable disparities that warrant attention
- 20-39: Significant pay equity issues
- 1-19: Extreme disparity

For the comparisons, include:
1. CEO-to-worker pay ratio at this company vs. national median (~272:1 in S&P 500)
2. User pay vs. estimated revenue-per-employee
3. User pay vs. median worker pay at the company (if CEO pay ratio is available)
4. Executive stock awards as a multiple of user's annual pay
5. If cost of living data is provided: user's disposable income after expenses vs. executive bonuses

Be specific with numbers. Avoid both minimizing real problems and manufacturing outrage.

Respond with ONLY the JSON object, no markdown code fences or other text.`
}

export function compensationAnalysisUserPrompt(
  params: CompensationAnalysisParams,
): string {
  const annualPayDollars = params.userPayDollars.toLocaleString()
  const jobTitle = params.userJobTitle ?? 'Not specified'
  const sector = params.companySector ?? 'Unknown'

  return `Analyze compensation fairness:

Employee Pay: $${annualPayDollars}/year
Job Title: ${jobTitle}

Company: ${params.companyName} (${params.companyTicker})
Sector: ${sector}

Executive Compensation:
${JSON.stringify(params.execComp, null, 2)}

Company Financials:
${JSON.stringify(params.companyFinancials, null, 2)}

Cost of Living:
${JSON.stringify(params.costOfLiving, null, 2)}`
}
