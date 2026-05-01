import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import classes from './MarkdownContent.module.css'

// External links open in a new tab. Everything else is styled by the
// `.prose` rules in the colocated CSS module — tags render as plain HTML
// rather than Mantine components so the cascade owns visual decisions.
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
}

export function MarkdownContent({ children }: { children: string }) {
  // Defensive: react-markdown's assertion error on non-string children is
  // cryptic ("expected string, got [object Object]") and breaks the whole
  // chunk. If a caller passes us the wrong shape (most often the result
  // *object* from a Claude prompt instead of one of its string fields),
  // surface it via console + render nothing.
  if (typeof children !== 'string') {
    console.warn('MarkdownContent expected string children, got:', children)
    return null
  }
  return (
    <article className={classes.prose}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </article>
  )
}
