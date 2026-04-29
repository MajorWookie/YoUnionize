import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Anchor, Code, List, Text, Title } from '@mantine/core'

export function MarkdownContent({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <Title order={2} mt="md" mb="sm">
            {children}
          </Title>
        ),
        h2: ({ children }) => (
          <Title order={3} mt="md" mb="sm">
            {children}
          </Title>
        ),
        h3: ({ children }) => (
          <Title order={4} mt="md" mb="xs">
            {children}
          </Title>
        ),
        p: ({ children }) => <Text mb="sm">{children}</Text>,
        a: ({ href, children }) => (
          <Anchor href={href} target="_blank" rel="noreferrer">
            {children}
          </Anchor>
        ),
        ul: ({ children }) => <List mb="sm">{children}</List>,
        ol: ({ children }) => (
          <List type="ordered" mb="sm">
            {children}
          </List>
        ),
        li: ({ children }) => <List.Item>{children}</List.Item>,
        code: ({ children }) => <Code>{children}</Code>,
        strong: ({ children }) => <Text component="strong" fw={700}>{children}</Text>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
