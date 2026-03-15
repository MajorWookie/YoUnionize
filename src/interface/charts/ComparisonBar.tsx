/**
 * Side-by-side comparison bar (e.g., assets vs liabilities).
 */
import { Paragraph, View, XStack, YStack } from 'tamagui'

interface ComparisonBarProps {
  leftLabel: string
  leftValue: number
  leftFormatted: string
  rightLabel: string
  rightValue: number
  rightFormatted: string
  leftColor?: string
  rightColor?: string
}

export function ComparisonBar({
  leftLabel,
  leftValue,
  leftFormatted,
  rightLabel,
  rightValue,
  rightFormatted,
  leftColor = '#069639',
  rightColor = '#3a6cbb',
}: ComparisonBarProps) {
  const total = leftValue + rightValue
  const leftPct = total > 0 ? (leftValue / total) * 100 : 50
  const rightPct = total > 0 ? (rightValue / total) * 100 : 50

  return (
    <YStack gap="$2">
      <XStack justifyContent="space-between">
        <YStack>
          <Paragraph fontSize={12} color="$color8">{leftLabel}</Paragraph>
          <Paragraph fontSize={16} fontWeight="700" color="$color12">{leftFormatted}</Paragraph>
        </YStack>
        <YStack alignItems="flex-end">
          <Paragraph fontSize={12} color="$color8">{rightLabel}</Paragraph>
          <Paragraph fontSize={16} fontWeight="700" color="$color12">{rightFormatted}</Paragraph>
        </YStack>
      </XStack>
      <XStack height={12} borderRadius={6} overflow="hidden" backgroundColor="$color4">
        <View
          height={12}
          width={`${Math.max(leftPct, 2)}%`}
          backgroundColor={leftColor}
          borderTopLeftRadius={6}
          borderBottomLeftRadius={6}
        />
        <View
          height={12}
          width={`${Math.max(rightPct, 2)}%`}
          backgroundColor={rightColor}
          borderTopRightRadius={6}
          borderBottomRightRadius={6}
        />
      </XStack>
    </YStack>
  )
}
