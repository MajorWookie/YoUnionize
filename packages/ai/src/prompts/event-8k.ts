import { scaffoldSystemPrompt, scaffoldUserPrompt } from './_scaffold'

export interface Event8kSummaryParams {
  /**
   * The 8-K event text. The caller is expected to prefix this with the
   * section's friendly name (e.g. `"Item 5.02 — Departure of Directors:\n…"`)
   * so that Claude has both the human-readable item label and the body in
   * a single payload. The friendly-name lookup lives in
   * `@younionize/sec-api` (`getSectionFriendlyName`); keeping the prefix
   * computation in the pipeline avoids a cross-package import.
   */
  section: string
  companyName: string
  filingType: string
}

/** Parsed JSON shape returned by `summarize8kEvent`. */
export interface Event8kSummaryResult {
  /** ~10-word action-led headline, plain language. */
  headline: string
  /** 2-3 sentence markdown body, plain-language summary of the event. */
  summary: string
}

const GUIDANCE = `Summarize this 8-K event for a social-feed-style card.

Produce two fields:
- "headline": a short, action-led sentence (about 10 words) that names the event in plain language. Lead with the subject and verb, e.g. "CEO Smith retires effective March 31" or "Company announces $500M debt offering". Do not start with "Item …" or the filing item number.
- "summary": 2-3 sentences in markdown that explain what happened, why it matters to regular employees, and any concrete numbers from the source. Stay grounded in the section text.`

const JSON_SHAPE =
  '{ "headline": "string, ~10 words, action-led", "summary": "string, markdown, 2-3 sentences" }'

export function event8kSummarySystemPrompt(): string {
  return scaffoldSystemPrompt({
    guidance: GUIDANCE,
    outputFormat: 'json',
    jsonShape: JSON_SHAPE,
    maxWords: 120,
  })
}

export function event8kSummaryUserPrompt(params: Event8kSummaryParams): string {
  return scaffoldUserPrompt({
    sectionLabel: 'Event',
    section: params.section,
    companyName: params.companyName,
    filingType: params.filingType,
  })
}
