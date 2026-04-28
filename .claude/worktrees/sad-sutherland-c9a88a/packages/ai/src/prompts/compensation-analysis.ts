export interface CompensationAnalysisParams {
  companyName: string
  execComp: string
  userPay?: number
  costOfLiving?: Record<string, number | null>
  companyFinancials?: string
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

export function compensationAnalysisUserPrompt(params: CompensationAnalysisParams): string {
  let prompt = `Analyze the compensation fairness at ${params.companyName}.

Executive compensation data:
${params.execComp}`

  if (params.userPay != null) {
    prompt += `\n\nThe employee asking this question earns $${(params.userPay / 100).toLocaleString()} per year (gross).`
  }

  if (params.costOfLiving && Object.keys(params.costOfLiving).length > 0) {
    const expenses = Object.entries(params.costOfLiving)
      .filter(([, v]) => v != null && v > 0)
      .map(([k, v]) => `  ${k}: $${((v as number) / 100).toLocaleString()}/month`)
      .join('\n')
    if (expenses) {
      prompt += `\n\nEmployee's monthly expenses:\n${expenses}`
    }
  }

  if (params.companyFinancials) {
    prompt += `\n\nCompany financial data:\n${params.companyFinancials}`
  }

  return prompt
}
