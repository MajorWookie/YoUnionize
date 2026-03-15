import { useState } from 'react'
import { Paragraph, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'

interface Props {
  title: string
  content: string | null | undefined
  /** Maximum lines to show before "Read more" */
  previewLines?: number
  /** Extra content to show below the text */
  children?: React.ReactNode
}

const PREVIEW_CHAR_LIMIT = 400

export function TextSummaryCard({ title, content, previewLines, children }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!content) return null

  const isLong = content.length > PREVIEW_CHAR_LIMIT
  const displayText = !isLong || expanded ? content : `${content.slice(0, PREVIEW_CHAR_LIMIT)}...`

  return (
    <Card pressable={isLong} onPress={isLong ? () => setExpanded((v) => !v) : undefined}>
      <Paragraph fontWeight="700" fontSize={16} marginBottom="$2">
        {title}
      </Paragraph>
      <Paragraph
        color="$color11"
        lineHeight={22}
        numberOfLines={!expanded && previewLines ? previewLines : undefined}
      >
        {displayText}
      </Paragraph>
      {isLong && (
        <Paragraph
          color="$color9"
          fontSize={13}
          fontWeight="600"
          marginTop="$2"
          cursor="pointer"
        >
          {expanded ? 'Show less' : 'Read more'}
        </Paragraph>
      )}
      {children}
    </Card>
  )
}
