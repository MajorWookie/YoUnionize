import { Card, Spoiler, Title } from '@mantine/core'
import { MarkdownContent } from '~/components/MarkdownContent'

interface Props {
  title: string
  content: string | null | undefined
  /** Collapsed height in px before "Show more" appears. Default 200. */
  maxHeight?: number
}

/**
 * Reusable card for AI-generated text sections. Renders a title + markdown
 * body, with Mantine's Spoiler auto-collapsing tall content. Returns null
 * when content is missing so the caller can compose conditionally without
 * extra branching.
 */
export function TextSummaryCard({ title, content, maxHeight = 200 }: Props) {
  if (!content?.trim()) return null
  return (
    <Card withBorder padding="lg" radius="md">
      <Title order={4} mb="sm">
        {title}
      </Title>
      <Spoiler maxHeight={maxHeight} showLabel="Show more" hideLabel="Hide">
        <MarkdownContent>{content}</MarkdownContent>
      </Spoiler>
    </Card>
  )
}
