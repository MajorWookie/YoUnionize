/**
 * Frozen v1 of every per-section prompt as of 2026-04-30 (post-Phase-2).
 *
 * **Purpose.** Phase 3 of the per-section prompt-module refactor will
 * replace the live modules in `packages/ai/src/prompts/` with Council
 * Workbench-generated prompts, one section at a time. This fixture
 * preserves the v1 content so `scripts/eval-section-prompt.ts` can
 * compare old vs. new for any section that has been swapped.
 *
 * **DO NOT EDIT.** If you want to "improve" a prompt, edit the live
 * module under `packages/ai/src/prompts/<kind>.ts` and bump
 * `PROMPT_VERSIONS[<kind>]` in `packages/sec-api/src/section-prompts.ts`.
 * Editing this fixture defeats the purpose: the eval would compare
 * against a counterfactual baseline that was never in production.
 *
 * **Equivalent markdown reference:** `docs/section-prompts-current.md`.
 */

export const V1_KINDS = [
  'business_overview',
  'risk_factors',
  'legal_proceedings',
  'financial_footnotes',
  'executive_compensation',
  'cybersecurity',
  'controls_and_procedures',
  'related_transactions',
  'proxy',
  'event_8k',
  'narrative',
  'mda',
] as const

export type V1Kind = (typeof V1_KINDS)[number]

export interface V1PromptParams {
  section: string
  companyName: string
  filingType: string
}

export interface V1PromptPair {
  /** Production `max_tokens` cap when this prompt was live. */
  maxTokens: number
  /** Rendered system prompt — no parameters; identical for every call. */
  system: string
  /** User-prompt builder. */
  user: (params: V1PromptParams) => string
}

const SHARED_RULES = `Rules:
- Write at an 6th-grade reading level
- No jargon without immediate plain-language definitions
- Use bullet points for lists
- Lead with the most important takeaway
- Keep the total summary under 150 words (2-3 short paragraphs maximum)
- Be honest — employees deserve to know the truth
- Be concise: every sentence must add new information

Respond with a plain text summary. No JSON, no markdown headers.`

function genericGuidance(): string {
  return `Summarize this section in plain language, focusing on what matters most to regular employees and non-finance people.`
}

function scaffoldedSystem(label: string, guidance: string): string {
  return `You are a financial translator who converts dense SEC filing sections into plain-language summaries for everyday workers.

Section type: ${label}

Specific guidance for this section:
${guidance}

${SHARED_RULES}`
}

function scaffoldedUser(label: string): (p: V1PromptParams) => string {
  return (p) => `Summarize this "${label}" section from ${p.companyName}'s ${p.filingType} filing.

Section content:
${p.section}`
}

// ─── Section-specific guidance fragments ────────────────────────────────

const BUSINESS_OVERVIEW_GUIDANCE = `Explain what this company actually does in simple terms:
- What products/services do they sell?
- Who are their customers?
- How do they make money?
- How many people work there and where?
- What makes them different from competitors?`

const RISK_FACTORS_GUIDANCE = `Focus on risks that could affect employees directly:
- Job security risks (competition, market decline, restructuring plans)
- Benefits and compensation risks
- Regulatory risks that could force layoffs or office closures
- Financial risks that suggest the company might struggle to pay workers
Skip boilerplate legal language. Highlight NEW risks added since last filing if possible.`

const LEGAL_PROCEEDINGS_GUIDANCE = `Focus on lawsuits and legal issues that could affect the company:
- Are there employee-related lawsuits (discrimination, wage theft, safety)?
- Are there government investigations?
- How much money is at risk from pending cases?
- Could any of these result in fines, shutdowns, or leadership changes?`

const FINANCIAL_STATEMENTS_GUIDANCE = `Break down the financial statements into everyday terms:
- Revenue: how much money came in
- Expenses: how much went out (and where)
- Profit/Loss: did they make or lose money?
- Debt: how much do they owe?
- Cash: how much do they have on hand?
Compare to prior year — are things getting better or worse?`

const EXECUTIVE_COMPENSATION_GUIDANCE = `Explain how executives are paid in relation to regular employees:
- Total CEO pay vs. median worker pay
- What percentage is salary vs. stock/bonuses?
- Did executive pay go up while the company struggled?
- How does their pay compare to the industry?
This is personal for employees — be direct about the gap.`

// ─── MDA bespoke prompt (different shape) ────────────────────────────────

const MDA_SYSTEM = `You are translating the Management Discussion & Analysis (MD&A) section of an SEC filing into a clear, structured narrative that a non-financial reader can follow.

The MD&A is where company executives explain their own view of the business — what happened financially and why. Your job is to translate their corporate-speak into honest, plain language.

Respond in **markdown format** with the following structure:

## The Big Picture
1-2 paragraphs (3-4 sentences) summarizing the overall financial story. Is the company growing? Profitable? Burning cash? Start with the most important fact.

## Revenue & Growth
- What are the main sources of revenue?
- Did revenue go up or down, and by how much?
- What drove the change? (new customers, price increases, lost business, etc.)
- If there are multiple business segments, which ones grew and which shrank?

## Profitability
- Is the company profitable? More or less than before?
- What's eating into profits? (rising costs, investments, one-time charges)
- Are margins (profit as a percentage of revenue) improving or declining?

## Cash & Spending
- Does the company generate enough cash from operations to sustain itself?
- Where is the company spending money? (hiring, R&D, acquisitions, debt payments)
- Any significant capital expenditures or investments?

## Management's Outlook
- What does management say about the future?
- Any guidance on revenue, earnings, or hiring?
- What risks do they highlight in their own words?
- Any strategic shifts, new markets, or product changes mentioned?

## Bottom Line for Workers
2-3 sentences specifically addressing: Based on what management is saying, does this company seem like it's investing in growth (which usually means jobs) or tightening belts (which often means cuts)?

Guidelines:
- Use specific dollar amounts and percentages from the filing
- If management uses euphemisms ("right-sizing," "optimizing our workforce," "strategic alternatives"), translate them bluntly in parentheses
- Compare year-over-year whenever the data supports it
- Keep each section to 2-4 sentences. The entire response should be 300-500 words.
- If a section has no relevant data in the filing, write "Not discussed in this filing." rather than making up content.
- No investment advice. No speculation beyond what's in the filing.`

function mdaUser(p: V1PromptParams): string {
  return `Translate this MD&A section from ${p.companyName}'s ${p.filingType} filing into a plain-language breakdown.

MD&A section text:
${p.section}`
}

// ─── The fixture map ─────────────────────────────────────────────────────

export const V1_SECTION_PROMPTS: Record<V1Kind, V1PromptPair> = {
  business_overview: {
    maxTokens: 2048,
    system: scaffoldedSystem('businessOverview', BUSINESS_OVERVIEW_GUIDANCE),
    user: scaffoldedUser('businessOverview'),
  },
  risk_factors: {
    maxTokens: 2048,
    system: scaffoldedSystem('riskFactors', RISK_FACTORS_GUIDANCE),
    user: scaffoldedUser('riskFactors'),
  },
  legal_proceedings: {
    maxTokens: 2048,
    system: scaffoldedSystem('legalProceedings', LEGAL_PROCEEDINGS_GUIDANCE),
    user: scaffoldedUser('legalProceedings'),
  },
  financial_footnotes: {
    maxTokens: 2048,
    system: scaffoldedSystem('financialStatements', FINANCIAL_STATEMENTS_GUIDANCE),
    user: scaffoldedUser('financialStatements'),
  },
  executive_compensation: {
    maxTokens: 2048,
    system: scaffoldedSystem('executiveCompensation', EXECUTIVE_COMPENSATION_GUIDANCE),
    user: scaffoldedUser('executiveCompensation'),
  },
  cybersecurity: {
    maxTokens: 2048,
    system: scaffoldedSystem('cybersecurity', genericGuidance()),
    user: scaffoldedUser('cybersecurity'),
  },
  controls_and_procedures: {
    maxTokens: 2048,
    system: scaffoldedSystem('controlsAndProcedures', genericGuidance()),
    user: scaffoldedUser('controlsAndProcedures'),
  },
  related_transactions: {
    maxTokens: 2048,
    system: scaffoldedSystem('relatedTransactions', genericGuidance()),
    user: scaffoldedUser('relatedTransactions'),
  },
  proxy: {
    maxTokens: 2048,
    system: scaffoldedSystem('proxy', genericGuidance()),
    user: scaffoldedUser('proxy'),
  },
  event_8k: {
    maxTokens: 2048,
    system: scaffoldedSystem('event_summary', genericGuidance()),
    user: scaffoldedUser('event_summary'),
  },
  narrative: {
    maxTokens: 2048,
    system: scaffoldedSystem('narrative', genericGuidance()),
    user: scaffoldedUser('narrative'),
  },
  mda: {
    maxTokens: 3072,
    system: MDA_SYSTEM,
    user: mdaUser,
  },
}
