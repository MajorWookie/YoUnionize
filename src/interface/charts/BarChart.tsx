/**
 * Simple SVG bar chart that works on both web and native (via react-native-svg).
 * Renders horizontal bars with labels and values.
 */
import { View as RNView } from 'react-native'
import { Paragraph, XStack, YStack, useTheme } from 'tamagui'

interface BarItem {
  label: string
  value: number
  formattedValue: string
}

interface BarChartProps {
  items: Array<BarItem>
  /** Color for positive values */
  positiveColor?: string
  /** Color for negative values */
  negativeColor?: string
}

export function BarChart({
  items,
  positiveColor = '#069639',
  negativeColor = '#e53e3e',
}: BarChartProps) {
  const theme = useTheme()
  const trackColor = theme.color4?.val ?? '#e2e8f0'

  if (items.length === 0) return null

  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value)), 1)

  return (
    <YStack gap="$2">
      {items.map((item, idx) => {
        const pct = Math.min(Math.abs(item.value) / maxAbs, 1) * 100
        const isNeg = item.value < 0
        const color = isNeg ? negativeColor : positiveColor

        return (
          <YStack key={`${item.label}-${idx}`} gap={2}>
            <XStack justify="space-between" items="center">
              <Paragraph fontSize={13} color="$color11" numberOfLines={1} flex={1}>
                {item.label}
              </Paragraph>
              <Paragraph fontSize={13} fontWeight="600" color="$color12">
                {item.formattedValue}
              </Paragraph>
            </XStack>
            <RNView
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: trackColor,
                overflow: 'hidden',
              }}
            >
              <RNView
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </RNView>
          </YStack>
        )
      })}
    </YStack>
  )
}
