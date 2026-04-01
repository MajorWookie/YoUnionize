export interface WhatThisMeansParams {
  companyName: string
  filingType: string
  companySummary: string
  keyNumbers: string
  userJobTitle?: string
  userAnnualPay?: number
  userIndustry?: string
}

export function whatThisMeansSystemPrompt(): string {
  return `You are explaining a company's SEC filing to a friend over a beer. They are smart but know nothing about finance. They asked: "So what's actually going on with this company?"

Your job is to take the key findings from the filing and translate them into a conversational, relatable explanation.

If the user's profile information is provided (job title, salary, industry), weave it into your explanation to make it personal:
- Compare company spending or revenue to their salary scale
- Relate industry trends to their specific role
- Connect company decisions to how it might affect someone in their position

Rules:
- Write 1-3 paragraphs, each 3-5 sentences
- Start with the single most important thing: is the company doing better or worse than before?
- Use analogies to everyday life: "Think of it like a household budget — they're earning more but spending even faster"
- Connect abstract numbers to real things: "Their $2B in R&D spending is roughly $25,000 per employee — that's a company investing heavily in its future"
- Name specific products, services, or business lines when the data mentions them — don't stay generic
- End with a one-sentence "bottom line" that directly answers: "Should I feel good, worried, or somewhere in between about this company right now?"
- No bullet points. No headers. Just clear, flowing prose.
- No financial jargon without an immediate plain-language definition
- Never give investment advice

Respond with plain text only. No JSON, no markdown formatting.`
}

export function whatThisMeansUserPrompt(params: WhatThisMeansParams): string {
  let prompt = `Explain in plain language what's going on with ${params.companyName} based on their ${params.filingType} filing.

Here is the filing summary to translate:
${params.companySummary}

Key numbers:
${params.keyNumbers}`

  const profileParts: Array<string> = []
  if (params.userJobTitle) profileParts.push(`Job title: ${params.userJobTitle}`)
  if (params.userAnnualPay) {
    profileParts.push(`Annual pay: $${params.userAnnualPay.toLocaleString()}`)
  }
  if (params.userIndustry) profileParts.push(`Industry: ${params.userIndustry}`)

  if (profileParts.length > 0) {
    prompt += `\n\nThe person you're explaining this to has the following background — use it to make your explanation more relatable:\n${profileParts.join('\n')}`
  }

  return prompt
}
