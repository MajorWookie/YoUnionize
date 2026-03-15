/**
 * Stacked waterfall chart showing income → expenses → remaining.
 * Each segment is a horizontal bar with label and amount.
 */
import { Paragraph, View, XStack, YStack } from 'tamagui'

interface WaterfallItem {
  label: string
  amount: number
  formattedAmount: string
  /** 'income' = green, 'expense' = red, 'result' = blue/green based on sign */
  type: 'income' | 'expense' | 'result'
}

interface WaterfallChartProps {
  items: Array<WaterfallItem>
}

const COLORS = {
  income: '#069639',
  expense: '#e53e3e',
  resultPositive: '#3a6cbb',
  resultNegative: '#e53e3e',
}

export function WaterfallChart({ items }: WaterfallChartProps) {
  if (items.length === 0) return null

  const maxAbs = Math.max(...items.map((i) => Math.abs(i.amount)), 1)

  return (
    <YStack gap="$2.5">
      {items.map((item, idx) => {
        const pct = Math.min(Math.abs(item.amount) / maxAbs, 1) * 100
        let color: string
        if (item.type === 'result') {
          color = item.amount >= 0 ? COLORS.resultPositive : COLORS.resultNegative
        } else {
          color = item.type === 'income' ? COLORS.income : COLORS.expense
        }

        const isResult = item.type === 'result'

        return (
          <YStack key={`${item.label}-${idx}`} gap={3}>
            <XStack justifyContent="space-between" alignItems="center">
              <Paragraph
                fontSize={13}
                color={isResult ? '$color12' : '$color11'}
                fontWeight={isResult ? '700' : '400'}
                numberOfLines={1}
                flex={1}
              >
                {item.label}
              </Paragraph>
              <Paragraph
                fontSize={14}
                fontWeight="700"
                color={color}
              >
                {item.formattedAmount}
              </Paragraph>
            </XStack>
            <View height={isResult ? 10 : 8} borderRadius={5} backgroundColor="$color4" overflow="hidden">
              <View
                height={isResult ? 10 : 8}
                borderRadius={5}
                width={`${Math.max(pct, 2)}%`}
                backgroundColor={color}
              />
            </View>
          </YStack>
        )
      })}
    </YStack>
  )
}
