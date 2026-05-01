// ─────────────────────────────────────────────────────────────────────────────
// AUTO-GENERATED — DO NOT EDIT
//
// Mirror of packages/ai/src/prompts/what-this-means.ts produced by
// scripts/generate-shared-prompts.ts. Edit the source file, then run:
//
//   bun run prompts:generate
//
// CI fails if this file drifts from the source.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// "What this means for you" personalized filing summary. Source-of-truth lives
// here; a verbatim copy is generated into
// supabase/functions/_shared/prompts/what-this-means.ts by
// scripts/generate-shared-prompts.ts so the Deno-runtime
// /api/company-personalize Edge Function can consume the same template.
//
// Edit this file, then run: bun run prompts:generate
// ─────────────────────────────────────────────────────────────────────────────

export interface WhatThisMeansParams {
  companyName: string
  filingType: string
  /** Free-form text — production passes headline + company_health joined. */
  companySummary: string
  /** Free-form text — production passes "label: value — context" lines, one per number. */
  keyNumbers: string
  userJobTitle?: string
  /** Annual pay in dollars (already converted from cents at the call site). */
  userAnnualPay?: number
}

export function whatThisMeansSystemPrompt(): string {
  return `You are explaining a company's SEC filing to a friend over coffee. They are smart but know nothing about finance. They asked: "So what's actually going on with this company?"

Your job is to take the key findings from the filing and translate them into a conversational, relatable explanation.

The user's profile information is provided — weave it into your explanation to make it personal:
- Compare company spending or revenue to their salary scale
- Relate industry trends to their specific role
- Connect company decisions to how it might affect someone in their position

Rules:
- Write 3-5 paragraphs, each 2-3 sentences
- Start with the single most important thing: is the company doing better or worse than before?
- Use analogies to everyday life
- Connect abstract numbers to real things relative to the user's pay
- End with a one-sentence "bottom line"
- No bullet points. No headers. Just clear, flowing prose.
- No financial jargon without an immediate plain-language definition
- Never give investment advice

Respond with plain text only. No JSON, no markdown formatting.`
}

export function whatThisMeansUserPrompt(params: WhatThisMeansParams): string {
  const profileParts: Array<string> = []
  if (params.userJobTitle) profileParts.push(`Job title: ${params.userJobTitle}`)
  if (params.userAnnualPay) {
    profileParts.push(`Annual pay: $${params.userAnnualPay.toLocaleString()}`)
  }

  return `Explain in plain language what's going on with ${params.companyName} based on their ${params.filingType} filing.

Here is the filing summary to translate:
${params.companySummary}

Key numbers:
${params.keyNumbers}

The person you're explaining this to has the following background — use it to make your explanation more relatable:
${profileParts.join('\n')}`
}
