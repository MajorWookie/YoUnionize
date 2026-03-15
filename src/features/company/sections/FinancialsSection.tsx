import { useState } from 'react'
import { Button, Paragraph, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { BarChart } from '~/interface/charts/BarChart'
import { ComparisonBar } from '~/interface/charts/ComparisonBar'
import type { FinancialStatement, FinancialLineItem } from '../types'
import { formatFinancial, formatPercent } from '../format'

interface Props {
  summary: Record<string, unknown>
}

type TabKey = 'income_statement' | 'balance_sheet' | 'cash_flow' | 'shareholders_equity'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'income_statement', label: 'Income' },
  { key: 'balance_sheet', label: 'Balance Sheet' },
  { key: 'cash_flow', label: 'Cash Flow' },
  { key: 'shareholders_equity', label: 'Equity' },
]

export function FinancialsSection({ summary }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('income_statement')

  // Check which tabs have data
  const availableTabs = TABS.filter((t) => {
    const data = summary[t.key]
    return data && typeof data === 'object' && 'items' in (data as Record<string, unknown>)
  })

  if (availableTabs.length === 0) return null

  const currentData = summary[activeTab] as FinancialStatement | undefined

  return (
    <YStack gap="$3">
      <Paragraph fontWeight="700" fontSize={16}>
        Financials
      </Paragraph>

      <XStack gap="$2" flexWrap="wrap">
        {availableTabs.map((tab) => (
          <Button
            key={tab.key}
            size="$2"
            theme={activeTab === tab.key ? 'accent' : undefined}
            variant={activeTab === tab.key ? undefined : 'outlined'}
            onPress={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </XStack>

      {currentData && <FinancialStatementView statement={currentData} tabKey={activeTab} />}
    </YStack>
  )
}

function FinancialStatementView({
  statement,
  tabKey,
}: {
  statement: FinancialStatement
  tabKey: TabKey
}) {
  return (
    <Card>
      <Paragraph fontWeight="600" marginBottom="$1">
        {statement.title}
      </Paragraph>
      <XStack marginBottom="$3" gap="$2">
        <Paragraph color="$color8" fontSize={12}>
          Current: {statement.periodCurrent}
        </Paragraph>
        {statement.periodPrior && (
          <Paragraph color="$color8" fontSize={12}>
            Prior: {statement.periodPrior}
          </Paragraph>
        )}
      </XStack>

      {tabKey === 'balance_sheet' ? (
        <BalanceSheetView items={statement.items} />
      ) : (
        <StatementTableView items={statement.items} />
      )}
    </Card>
  )
}

function StatementTableView({ items }: { items: Array<FinancialLineItem> }) {
  // Show bar chart for the main items
  const chartItems = items
    .filter((i) => i.current != null)
    .map((i) => ({
      label: i.label,
      value: i.current ?? 0,
      formattedValue: formatFinancial(i.current),
    }))

  return (
    <YStack gap="$3">
      <BarChart items={chartItems} />

      {/* Detailed table below chart */}
      <YStack gap="$1" marginTop="$2">
        {items.map((item) => (
          <XStack
            key={item.label}
            justifyContent="space-between"
            alignItems="center"
            paddingVertical="$1"
            borderBottomWidth={1}
            borderBottomColor="$color3"
          >
            <Paragraph fontSize={13} color="$color11" flex={1} numberOfLines={1}>
              {item.label}
            </Paragraph>
            <XStack gap="$3" alignItems="center">
              <Paragraph fontSize={13} fontWeight="600" color="$color12" width={90} textAlign="right">
                {formatFinancial(item.current)}
              </Paragraph>
              {item.prior != null && (
                <Paragraph fontSize={12} color="$color8" width={80} textAlign="right">
                  {formatFinancial(item.prior)}
                </Paragraph>
              )}
              {item.changePercent != null && (
                <Paragraph
                  fontSize={12}
                  fontWeight="600"
                  color={item.changePercent > 0 ? '$positive' : item.changePercent < 0 ? '$negative' : '$color8'}
                  width={60}
                  textAlign="right"
                >
                  {formatPercent(item.changePercent)}
                </Paragraph>
              )}
            </XStack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}

function BalanceSheetView({ items }: { items: Array<FinancialLineItem> }) {
  // Find total assets and total liabilities for the comparison bar
  const totalAssets = items.find((i) => i.label === 'Total Assets')
  const totalLiabilities = items.find((i) => i.label === 'Total Liabilities')
  const equity = items.find((i) => i.label === "Stockholders' Equity")

  return (
    <YStack gap="$3">
      {totalAssets && totalLiabilities && (
        <ComparisonBar
          leftLabel="Total Assets"
          leftValue={Math.abs(totalAssets.current ?? 0)}
          leftFormatted={formatFinancial(totalAssets.current)}
          rightLabel="Total Liabilities"
          rightValue={Math.abs(totalLiabilities.current ?? 0)}
          rightFormatted={formatFinancial(totalLiabilities.current)}
          leftColor="#069639"
          rightColor="#e53e3e"
        />
      )}

      {equity && (
        <YStack gap="$1">
          <Paragraph color="$color8" fontSize={12}>Stockholders' Equity</Paragraph>
          <Paragraph fontSize={20} fontWeight="700" color="$color12">
            {formatFinancial(equity.current)}
          </Paragraph>
          {equity.changePercent != null && (
            <Paragraph
              fontSize={12}
              fontWeight="600"
              color={equity.changePercent > 0 ? '$positive' : '$negative'}
            >
              {formatPercent(equity.changePercent)} from prior period
            </Paragraph>
          )}
        </YStack>
      )}

      {/* Full table */}
      <YStack gap="$1" marginTop="$2">
        {items.map((item) => (
          <XStack
            key={item.label}
            justifyContent="space-between"
            alignItems="center"
            paddingVertical="$1"
            borderBottomWidth={1}
            borderBottomColor="$color3"
          >
            <Paragraph fontSize={13} color="$color11" flex={1}>
              {item.label}
            </Paragraph>
            <XStack gap="$3">
              <Paragraph fontSize={13} fontWeight="600" color="$color12" width={90} textAlign="right">
                {formatFinancial(item.current)}
              </Paragraph>
              {item.changePercent != null && (
                <Paragraph
                  fontSize={12}
                  fontWeight="600"
                  color={item.changePercent > 0 ? '$positive' : item.changePercent < 0 ? '$negative' : '$color8'}
                  width={60}
                  textAlign="right"
                >
                  {formatPercent(item.changePercent)}
                </Paragraph>
              )}
            </XStack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}
