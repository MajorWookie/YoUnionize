import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownContent } from './MarkdownContent'

const FIXTURE = `# Top-level heading

## Section heading

### Subsection heading

Some paragraph text with **bold** emphasis and an [external link](https://example.com).

- bullet one
- bullet two

| col a | col b |
|-------|-------|
| 1     | 2     |

> A blockquote.

\`\`\`
code block
\`\`\`
`

describe('MarkdownContent', () => {
  it('wraps output in an <article> with a className', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { children: FIXTURE }),
    )
    // The CSS module class is hashed at build time, but the article tag
    // and its className attribute must always be present.
    expect(html).toMatch(/<article[^>]*class=/)
  })

  it('renders semantic heading levels (h1, h2, h3)', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { children: FIXTURE }),
    )
    expect(html).toContain('<h1>Top-level heading</h1>')
    expect(html).toContain('<h2>Section heading</h2>')
    expect(html).toContain('<h3>Subsection heading</h3>')
  })

  it('renders anchors with target="_blank" for new-tab navigation', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, {
        children: '[example](https://example.com)',
      }),
    )
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer"')
  })

  it('renders <strong> for bold so the prose CSS can swap it back to sans', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { children: '**emphatic**' }),
    )
    expect(html).toContain('<strong>emphatic</strong>')
  })

  it('renders blockquote, lists, code, and tables as plain HTML for prose CSS', () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { children: FIXTURE }),
    )
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<table>')
    expect(html).toMatch(/<pre>[\s\S]*<code>/)
  })

  it('returns null and warns for non-string children', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = renderToStaticMarkup(
      // Intentionally pass a non-string to verify the defensive guard.
      createElement(MarkdownContent, {
        children: { unexpected: 'object' } as unknown as string,
      }),
    )
    expect(html).toBe('')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
