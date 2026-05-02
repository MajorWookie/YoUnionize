/**
 * Shared scaffold for every per-section SEC summary prompt.
 *
 * All 12 per-section prompt modules call `scaffoldSystemPrompt` and
 * `scaffoldUserPrompt`. The persona and the universal writing rules
 * (reading level, no jargon, bullet usage, lead-with-takeaway, honesty,
 * concision, source fidelity) are fixed.
 *
 * Output shape varies by section via `ScaffoldOptions`:
 *   • `maxWords` — total length cap. Default 150.
 *   • `outputFormat` — 'plain' (default), 'structured-markdown', or 'json'.
 *   • `requiredSections` — required when 'structured-markdown'; the list
 *     of `## Heading` blocks the model must produce, in order.
 *   • `jsonShape` — required when 'json'; one-line schema description
 *     embedded in the prompt to constrain the JSON output.
 *
 * Adding a new override here is a deliberate scope decision: each axis is
 * a parameter, not a free-form rules string, so per-section modules
 * declare *intent* (e.g., "MDA wants structured markdown with these 6
 * sections", "8-K wants JSON with headline+summary fields") rather than
 * copying rule text. If a future need can't be expressed via these
 * parameters, expand the schema rather than allowing sections to fork
 * the rules block.
 */

const PERSONA = `You are a financial translator who converts dense SEC filing sections into plain-language summaries for everyday workers.`

const UNIVERSAL_RULES = `Universal writing rules:
- Write at a 6th-grade reading level (simple words, short sentences)
- Avoid jargon completely. If you must use a technical term, immediately define it in plain language
- Use bullet points when listing multiple items
- Start with the most important takeaway
- Be honest and straightforward — employees deserve to know the truth about their company
- Be concise — every sentence must add new information. Do not repeat yourself
- Stay grounded in the source. If a fact is not in the section text, do not include it.`

export type OutputFormat = 'plain' | 'structured-markdown' | 'json'

export interface ScaffoldOptions {
  guidance: string
  /** Total word-count cap for the entire response. Default 150. */
  maxWords?: number
  /** Output shape. Default 'plain'. */
  outputFormat?: OutputFormat
  /**
   * Required `## Heading` sections, in order. Required when
   * `outputFormat === 'structured-markdown'`; ignored otherwise.
   */
  requiredSections?: string[]
  /**
   * JSON schema description (one-line shape, e.g.
   * `{ "headline": "string ~10 words", "summary": "markdown, 2-3 sentences" }`).
   * Required when `outputFormat === 'json'`; ignored otherwise.
   */
  jsonShape?: string
}

export interface ScaffoldUserParams {
  sectionLabel: string
  section: string
  companyName: string
  filingType: string
}

const DEFAULT_MAX_WORDS = 150

function buildOutputRules(opts: ScaffoldOptions): string {
  const maxWords = opts.maxWords ?? DEFAULT_MAX_WORDS
  const format = opts.outputFormat ?? 'plain'

  if (format === 'plain') {
    return `Output rules:
- Keep your total summary under ${maxWords} words (2-3 short paragraphs maximum)
- Format your response as plain text only. Do not use JSON, markdown headers, or any special formatting beyond basic bullet points.`
  }

  if (format === 'json') {
    if (!opts.jsonShape) {
      throw new Error(
        "scaffoldSystemPrompt: outputFormat='json' requires a jsonShape string",
      )
    }
    return `Output rules:
- Respond with a single JSON object — no prose, no markdown fences.
- Schema: ${opts.jsonShape}
- Keep the entire response under ${maxWords} words.`
  }

  // structured-markdown
  if (!opts.requiredSections || opts.requiredSections.length === 0) {
    throw new Error(
      "scaffoldSystemPrompt: outputFormat='structured-markdown' requires a non-empty requiredSections array",
    )
  }

  const headings = opts.requiredSections.map((s) => `## ${s}`).join('\n')
  return `Output rules:
- Respond in markdown with the following sections, in this exact order:

${headings}

- Each section is required. If a section has no relevant data in the source, write "Not discussed in this filing." rather than making up content.
- Keep each section to 2-4 sentences. The total response should be no more than ${maxWords} words.
- Use specific dollar amounts and percentages from the source whenever they support the answer.`
}

export function scaffoldSystemPrompt(opts: ScaffoldOptions): string {
  return `${PERSONA}

${opts.guidance}

${UNIVERSAL_RULES}

${buildOutputRules(opts)}`
}

export function scaffoldUserPrompt(opts: ScaffoldUserParams): string {
  return `Here is the SEC filing section you need to translate. It is the ${opts.sectionLabel} section from ${opts.companyName}'s ${opts.filingType} filing.

<sec_filing_section>
${opts.section}
</sec_filing_section>

Write your summary now.`
}
