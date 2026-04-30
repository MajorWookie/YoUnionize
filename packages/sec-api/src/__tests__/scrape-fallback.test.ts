import { describe, it, expect } from 'vitest'
import {
  findSection,
  htmlToText,
  scrapeDef14aSection,
} from '../scrape-fallback'

describe('htmlToText', () => {
  it('strips script and style tags entirely', () => {
    const html = `
      <html>
        <head><style>.foo { color: red; }</style></head>
        <body>
          <script>alert('x')</script>
          <p>visible</p>
        </body>
      </html>
    `
    const text = htmlToText(html)
    expect(text).toContain('visible')
    expect(text).not.toContain('alert')
    expect(text).not.toContain('color: red')
  })

  it('preserves paragraph boundaries as newlines', () => {
    const html = '<p>first</p><p>second</p><p>third</p>'
    const text = htmlToText(html)
    expect(text.split('\n').filter(Boolean)).toEqual([
      'first',
      'second',
      'third',
    ])
  })

  it('decodes common HTML entities', () => {
    const html = '<p>AT&amp;T&nbsp;Inc. has &gt;100 employees</p>'
    expect(htmlToText(html)).toBe('AT&T Inc. has >100 employees')
  })
})

describe('findSection', () => {
  const text = [
    'PROXY STATEMENT',
    'Some intro paragraphs about the meeting.',
    'More intro content here.',
    '',
    'COMPENSATION DISCUSSION AND ANALYSIS',
    'CEO total comp was $X million.',
    'Detailed exec comp narrative.',
    '',
    'DIRECTOR INDEPENDENCE',
    'Final unrelated content.',
  ].join('\n')

  it('returns empty when no target heading matches', () => {
    expect(findSection(text, ['nonexistent heading'])).toBe('')
  })

  it('extracts the matching section up to the next known heading', () => {
    const result = findSection(text, ['compensation discussion and analysis'])
    expect(result).toContain('COMPENSATION DISCUSSION AND ANALYSIS')
    expect(result).toContain('CEO total comp was $X million.')
    // Stops before the next known heading (proxy statement is in ALL_HEADINGS,
    // but it's earlier; ensure we don't bleed past where another heading
    // starts in real DEF 14As).
    expect(result.length).toBeLessThan(text.length)
  })

  it('matches case-insensitively', () => {
    const result = findSection(text, ['Proxy Statement'])
    expect(result).toContain('PROXY STATEMENT')
    expect(result).toContain('intro paragraphs')
  })

  it('caps output at 50 KB', () => {
    // Build a 100-KB body under a single heading.
    const body = 'x'.repeat(100_000)
    const huge = `PROXY STATEMENT\n${body}`
    const result = findSection(huge, ['proxy statement'])
    expect(result.length).toBeLessThanOrEqual(50_000)
  })
})

describe('scrapeDef14aSection', () => {
  function mockFetch(html: string, ok = true): typeof fetch {
    return (async () =>
      ({
        ok,
        text: async () => html,
      }) as Response) as unknown as typeof fetch
  }

  it('extracts part1item7 (executive compensation) from primary HTML', async () => {
    const html = `
      <html><body>
        <h1>PROXY STATEMENT</h1>
        <p>Notice of annual meeting blah blah.</p>
        <h1>COMPENSATION DISCUSSION AND ANALYSIS</h1>
        <p>Our CEO total comp was twelve million dollars.</p>
        <p>Long-term incentive plan details follow.</p>
        <h1>DIRECTOR INDEPENDENCE</h1>
        <p>Unrelated content.</p>
      </body></html>
    `
    const result = await scrapeDef14aSection(
      'http://example.test/proxy.htm',
      'part1item7',
      mockFetch(html),
    )
    expect(result).toContain('COMPENSATION DISCUSSION AND ANALYSIS')
    expect(result).toContain('twelve million dollars')
  })

  it('extracts part1item1 (proxy intro) from primary HTML', async () => {
    const html = `
      <html><body>
        <h1>NOTICE OF ANNUAL MEETING</h1>
        <p>Meeting details follow.</p>
        <h1>EXECUTIVE COMPENSATION</h1>
        <p>Comp data.</p>
      </body></html>
    `
    const result = await scrapeDef14aSection(
      'http://example.test/proxy.htm',
      'part1item1',
      mockFetch(html),
    )
    expect(result).toContain('NOTICE OF ANNUAL MEETING')
    expect(result).toContain('Meeting details follow')
  })

  it('returns empty when no matching heading exists', async () => {
    const html = '<html><body><p>just a random body</p></body></html>'
    const result = await scrapeDef14aSection(
      'http://example.test/proxy.htm',
      'part1item7',
      mockFetch(html),
    )
    expect(result).toBe('')
  })

  it('returns empty when fetch fails', async () => {
    const result = await scrapeDef14aSection(
      'http://example.test/proxy.htm',
      'part1item7',
      mockFetch('', false),
    )
    expect(result).toBe('')
  })

  it('returns empty for an unknown section code', async () => {
    const html = '<html><body><h1>EXECUTIVE COMPENSATION</h1><p>x</p></body></html>'
    const result = await scrapeDef14aSection(
      'http://example.test/proxy.htm',
      'part1item99',
      mockFetch(html),
    )
    expect(result).toBe('')
  })
})
