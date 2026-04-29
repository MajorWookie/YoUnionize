import { useMemo, useState } from 'react'
import {
  Card,
  Group,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { BarChart } from '@mantine/charts'
import {
  formatDollarsCompact,
  formatPercent,
} from '~/lib/format'

import type {
  FinancialLineItem,
  FinancialStatement,
} from '~/lib/financial-types'

type StatementKey =
  | 'income_statement'
  | 'balance_sheet'
  | 'cash_flow'
  | 'shareholders_equity'

const TABS: Array<{ key: StatementKey; label: string }> = [
  { key: 'income_statement', label: 'Income' },
  { key: 'balance_sheet', label: 'Balance Sheet' },
  { key: 'cash_flow', label: 'Cash Flow' },
  { key: 'shareholders_equity', label: 'Equity' },
]

interface Props {
  summary: Record<string, unknown>
}

function asStatement(value: unknown): FinancialStatement | undefined {
  if (!value || typeof value !== 'object') return undefined
  const obj = value as Record<string, unknown>
  if (typeof obj.title !== 'string') return undefined
  if (!Array.isArray(obj.items)) return undefined
  return obj as unknown as FinancialStatement
}

function changeColor(pct: number | null): string {
  if (pct == null) return 'slate.7'
  if (pct > 0) return 'green.7'
  if (pct < 0) return 'red.7'
  return 'slate.7'
}

export function FinancialsSection({ summary }: Props) {
  const statements = useMemo(() => {
    const map = new Map<StatementKey, FinancialStatement>()
    for (const t of TABS) {
      const s = asStatement(summary[t.key])
      if (s) map.set(t.key, s)
    }
    return map
  }, [summary])

  const availableTabs = TABS.filter((t) => statements.has(t.key))
  const [activeTab, setActiveTab] = useState<StatementKey | null>(
    availableTabs[0]?.key ?? null,
  )

  if (availableTabs.length === 0 || !activeTab) return null

  return (
    <Stack gap="md">
      <Title order={3}>Financials</Title>
      <Tabs
        value={activeTab}
        onChange={(v) => v && setActiveTab(v as StatementKey)}
        variant="outline"
      >
        <Tabs.List>
          {availableTabs.map((t) => (
            <Tabs.Tab key={t.key} value={t.key}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {availableTabs.map((t) => {
          const statement = statements.get(t.key)!
          return (
            <Tabs.Panel key={t.key} value={t.key} pt="md">
              <StatementView statement={statement} />
            </Tabs.Panel>
          )
        })}
      </Tabs>
    </Stack>
  )
}

function StatementView({ statement }: { statement: FinancialStatement }) {
  // Items with a non-null current value go into the chart; the table shows
  // every line including the ones missing values (rendered as "–").
  const chartItems = statement.items
    .filter((i) => i.current != null && i.current !== 0)
    .map((i) => ({
      label: i.label,
      Current: i.current as number,
    }))

  const chartHeight = Math.max(220, Math.min(chartItems.length * 36, 480))

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="sm">
        <div>
          <Text fw={600}>{statement.title}</Text>
          <Group gap="md" mt={2}>
            <Text size="xs" c="slate.7">
              Current: {statement.periodCurrent}
            </Text>
            {statement.periodPrior && (
              <Text size="xs" c="slate.7">
                Prior: {statement.periodPrior}
              </Text>
            )}
          </Group>
        </div>

        {chartItems.length > 0 && (
          <BarChart
            h={chartHeight}
            data={chartItems}
            dataKey="label"
            orientation="vertical"
            yAxisProps={{ width: 140 }}
            valueFormatter={(v) => formatDollarsCompact(v)}
            series={[{ name: 'Current', color: 'navy.6' }]}
            withTooltip
          />
        )}

        <Table
          horizontalSpacing="md"
          verticalSpacing="xs"
          highlightOnHover
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Line item</Table.Th>
              <Table.Th ta="right">Current</Table.Th>
              <Table.Th ta="right">Prior</Table.Th>
              <Table.Th ta="right">Change</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {statement.items.map((item) => (
              <Table.Tr key={item.label}>
                <Table.Td>
                  <Text size="sm">{item.label}</Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" ff="monospace" fw={500}>
                    {formatDollarsCompact(item.current)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" ff="monospace" c="slate.7">
                    {formatDollarsCompact(item.prior)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    size="sm"
                    ff="monospace"
                    fw={500}
                    c={changeColor(item.changePercent)}
                  >
                    {formatPercent(item.changePercent)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  )
}
