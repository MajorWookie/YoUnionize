/**
 * Last-resort fallback for DEF 14A section extraction.
 *
 * sec-api.io's `/extractor` endpoint expects the rigid 10-K/10-Q
 * "Part X Item Y" item taxonomy. DEF 14A proxy statements are
 * free-form, so the extractor 404s on `part1item1` and `part1item7`
 * for many filings (the client treats this as semantically empty).
 *
 * This helper fetches the filing's primary HTML directly from
 * SEC.gov, strips it to plain text, and slices out the section
 * matching one of a known set of DEF 14A headings. Returns '' if
 * no heading matches — same shape as the upstream empty path.
 *
 * Caveats
 *   - Heuristic. Filings with unusual heading wording will miss.
 *   - Hits SEC.gov directly. SEC requires a self-identifying
 *     User-Agent (https://www.sec.gov/os/accessing-edgar-data);
 *     supply via the SEC_USER_AGENT env var.
 *   - Caps output at 50 KB so a 200-page proxy statement doesn't
 *     overflow Claude's context window downstream.
 */

const DEF_14A_SECTION_HEADINGS: Record<string, ReadonlyArray<string>> = {
  // part1item1 — proxy statement / notice of meeting
  part1item1: [
    'proxy statement',
    'notice of annual meeting',
    'notice of meeting',
    'about this proxy',
    'about the proxy statement',
    'introduction',
    'voting information',
    'general information',
  ],
  // part1item7 — executive compensation discussion
  part1item7: [
    'compensation discussion and analysis',
    'compensation discussion & analysis',
    'executive compensation',
    'compensation disclosure',
    'compensation tables',
    'summary compensation table',
  ],
}

const ALL_HEADINGS: ReadonlyArray<string> = Object.values(
  DEF_14A_SECTION_HEADINGS,
).flat()

const MAX_OUTPUT_CHARS = 50_000

/**
 * Fetch the primary HTML of a DEF 14A filing and extract the section
 * matching the given section code. Returns '' if the section can't be
 * located or the fetch fails.
 */
export async function scrapeDef14aSection(
  htmlUrl: string,
  sectionCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const headings = DEF_14A_SECTION_HEADINGS[sectionCode]
  if (!headings) return ''

  const html = await fetchSecHtml(htmlUrl, fetchImpl)
  if (!html) return ''

  const text = htmlToText(html)
  return findSection(text, headings)
}

async function fetchSecHtml(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const userAgent =
    (typeof process !== 'undefined' && process.env?.SEC_USER_AGENT) ||
    'YoUnionize/1.0 noreply@younionize.app'
  try {
    const res = await fetchImpl(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/**
 * Strip HTML to plain text. Keeps paragraph and heading boundaries as
 * newlines so the heading scan can work line-by-line.
 */
export function htmlToText(html: string): string {
  let s = html
  // Drop scripts / styles outright.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // Block-level elements become newline boundaries.
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|td|th)\s*>/gi, '\n')
  // Strip remaining tags.
  s = s.replace(/<[^>]+>/g, ' ')
  // Decode common HTML entities.
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    )
  // Normalize whitespace.
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/\n[ \t]+/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

/**
 * Locate the earliest matching heading in `text` and slice from there
 * to the next known heading (or until 50 KB has been collected).
 * Returns '' when nothing matches.
 */
export function findSection(
  text: string,
  targetHeadings: ReadonlyArray<string>,
): string {
  const lower = text.toLowerCase()

  // Find the earliest occurrence of any target heading.
  let bestIdx = -1
  let matchLength = 0
  for (const h of targetHeadings) {
    const idx = lower.indexOf(h.toLowerCase())
    if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
      bestIdx = idx
      matchLength = h.length
    }
  }
  if (bestIdx < 0) return ''

  // From the heading, look for the next known DIFFERENT heading and
  // cut there. Skip past the matched heading itself plus a small
  // buffer so we don't immediately re-match.
  const searchFrom = bestIdx + matchLength + 50
  let endIdx = text.length

  for (const h of ALL_HEADINGS) {
    const candidate = lower.indexOf(h.toLowerCase(), searchFrom)
    if (candidate >= 0 && candidate < endIdx) {
      endIdx = candidate
    }
  }

  // Cap output size so a 200-page proxy doesn't drown Claude's context.
  if (endIdx - bestIdx > MAX_OUTPUT_CHARS) {
    endIdx = bestIdx + MAX_OUTPUT_CHARS
  }

  return text.slice(bestIdx, endIdx).trim()
}
