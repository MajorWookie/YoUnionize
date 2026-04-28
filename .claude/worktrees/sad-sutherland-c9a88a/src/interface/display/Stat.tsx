import { Paragraph, YStack } from 'tamagui'

interface StatProps {
  label: string
  value: string
  /** Positive = green arrow up, negative = red arrow down, zero/null = neutral */
  trend?: number | null
  /** e.g. "+12.3%" */
  trendLabel?: string | null
}

export function Stat({ label, value, trend, trendLabel }: StatProps) {
  const trendColor =
    trend == null || trend === 0
      ? '$color8'
      : trend > 0
        ? '$positive'
        : '$negative'

  const trendArrow =
    trend == null || trend === 0 ? '' : trend > 0 ? '\u2191 ' : '\u2193 '

  return (
    <YStack gap="$1">
      <Paragraph color="$color8" fontSize={13} fontWeight="500">
        {label}
      </Paragraph>
      <Paragraph fontSize={24} fontWeight="700" color="$color12">
        {value}
      </Paragraph>
      {trendLabel != null && (
        <Paragraph fontSize={13} fontWeight="600" color={trendColor}>
          {trendArrow}
          {trendLabel}
        </Paragraph>
      )}
    </YStack>
  )
}
