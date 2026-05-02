import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface MdaSummaryParams {
  section: string
  companyName: string
  filingType: string
}

const GUIDANCE = `Translate the Management Discussion & Analysis into a structured plain-language breakdown for workers.

The MD&A is where company executives explain their own view of the business — what happened financially and why. Your job is to translate corporate-speak into honest, plain language a non-financial reader can follow.

For each required section below, follow this guidance:

- The Big Picture — 1-2 paragraphs (3-4 sentences) summarizing the overall financial story. Is the company growing? Profitable? Burning cash? Lead with the most important fact.
- Revenue & Growth — Main sources of revenue. Did revenue go up or down, and by how much? What drove the change (new customers, price increases, lost business)? If there are multiple segments, which grew and which shrank?
- Profitability — Is the company profitable? More or less than before? What's eating into profits (rising costs, investments, one-time charges)? Are margins improving or declining?
- Cash & Spending — Does the company generate enough cash from operations to sustain itself? Where is money being spent (hiring, R&D, acquisitions, debt payments)? Any significant capital expenditures?
- Management's Outlook — What does management say about the future? Any guidance on revenue, earnings, or hiring? What risks do they highlight in their own words? Any strategic shifts mentioned?
- Bottom Line for Workers — 2-3 sentences specifically addressing: based on what management is saying, does this company seem to be investing in growth (which usually means jobs) or tightening belts (which often means cuts)?

Translate corporate euphemisms ("right-sizing," "optimizing our workforce," "strategic alternatives") bluntly. Compare year-over-year whenever the data supports it. No investment advice; no speculation beyond what's in the filing.`

const REQUIRED_SECTIONS = [
  'The Big Picture',
  'Revenue & Growth',
  'Profitability',
  'Cash & Spending',
  "Management's Outlook",
  'Bottom Line for Workers',
]

export function mdaSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({
    guidance: GUIDANCE,
    maxWords: 500,
    outputFormat: 'structured-markdown',
    requiredSections: REQUIRED_SECTIONS,
  })
}

export function mdaSummaryUserPrompt(params: MdaSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Management Discussion & Analysis',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
