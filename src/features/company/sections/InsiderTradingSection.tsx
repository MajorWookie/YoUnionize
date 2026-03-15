import { Paragraph, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import type { InsiderTradeData } from '../types'
import { formatCents, formatShares, formatDate } from '../format'

interface Props {
  trades: Array<InsiderTradeData>
}

const TYPE_LABELS: Record<string, string> = {
  purchase: 'Buy',
  sale: 'Sell',
  grant: 'Grant',
  exercise: 'Exercise',
  gift: 'Gift',
  other: 'Other',
}

export function InsiderTradingSection({ trades }: Props) {
  if (trades.length === 0) return null

  return (
    <YStack gap="$3">
      <Paragraph fontWeight="700" fontSize={16}>
        Insider Trading
      </Paragraph>

      <Card>
        {/* Table header */}
        <XStack
          paddingBottom="$2"
          borderBottomWidth={1}
          borderBottomColor="$color4"
          marginBottom="$1"
        >
          <Paragraph fontSize={11} fontWeight="600" color="$color8" flex={2}>
            Name
          </Paragraph>
          <Paragraph fontSize={11} fontWeight="600" color="$color8" width={50} textAlign="center">
            Type
          </Paragraph>
          <Paragraph fontSize={11} fontWeight="600" color="$color8" width={70} textAlign="right">
            Shares
          </Paragraph>
          <Paragraph fontSize={11} fontWeight="600" color="$color8" width={80} textAlign="right">
            Value
          </Paragraph>
          <Paragraph fontSize={11} fontWeight="600" color="$color8" width={80} textAlign="right">
            Date
          </Paragraph>
        </XStack>

        {/* Table rows */}
        {trades.slice(0, 20).map((trade) => {
          const typeLabel = TYPE_LABELS[trade.transactionType ?? ''] ?? trade.transactionType ?? '-'
          const isBuy = trade.transactionType === 'purchase'
          const isSell = trade.transactionType === 'sale'

          return (
            <XStack
              key={trade.id}
              paddingVertical="$1.5"
              borderBottomWidth={1}
              borderBottomColor="$color3"
              alignItems="center"
            >
              <YStack flex={2}>
                <Paragraph fontSize={13} fontWeight="500" numberOfLines={1}>
                  {trade.filerName}
                </Paragraph>
                {trade.filerTitle && (
                  <Paragraph fontSize={11} color="$color8" numberOfLines={1}>
                    {trade.filerTitle}
                  </Paragraph>
                )}
              </YStack>
              <Paragraph
                fontSize={12}
                fontWeight="600"
                width={50}
                textAlign="center"
                color={isBuy ? '$positive' : isSell ? '$negative' : '$color8'}
              >
                {typeLabel}
              </Paragraph>
              <Paragraph fontSize={12} width={70} textAlign="right" color="$color11">
                {formatShares(trade.shares)}
              </Paragraph>
              <Paragraph fontSize={12} width={80} textAlign="right" color="$color11">
                {trade.totalValue != null ? formatCents(trade.totalValue) : '-'}
              </Paragraph>
              <Paragraph fontSize={11} width={80} textAlign="right" color="$color8">
                {formatDate(trade.transactionDate)}
              </Paragraph>
            </XStack>
          )
        })}
      </Card>
    </YStack>
  )
}
