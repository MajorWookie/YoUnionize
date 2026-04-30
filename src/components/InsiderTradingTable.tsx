import { Badge, Card, Stack, Table, Text, Title } from '@mantine/core'
import {
  formatDate,
  formatDollarsCompact,
  formatShares,
} from '~/lib/format'

export interface InsiderTrade {
  id: string
  filerName: string
  filerTitle: string | null
  transactionDate: string
  transactionType: string | null
  shares: string | null
  totalValue: number | null
}

interface Props {
  trades: Array<InsiderTrade>
  /** Max rows to render. Default 20. */
  limit?: number
}

const TYPE_LABELS: Record<string, string> = {
  purchase: 'Buy',
  sale: 'Sell',
  grant: 'Grant',
  exercise: 'Exercise',
  gift: 'Gift',
  other: 'Other',
}

function typeColor(type: string | null): string {
  if (type === 'purchase') return 'green'
  if (type === 'sale') return 'red'
  return 'gray'
}

export function InsiderTradingTable({ trades, limit = 20 }: Props) {
  if (trades.length === 0) return null

  const visible = trades.slice(0, limit)
  const overflow = trades.length - visible.length

  return (
    <Stack gap="md">
      <Title order={3}>Insider Trading</Title>
      <Card withBorder padding={0} radius="md">
        <Table
          horizontalSpacing="md"
          verticalSpacing="xs"
          highlightOnHover
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Filer</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th ta="right">Shares</Table.Th>
              <Table.Th ta="right">Value</Table.Th>
              <Table.Th ta="right">Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visible.map((trade) => {
              const label =
                TYPE_LABELS[trade.transactionType ?? ''] ??
                trade.transactionType ??
                '–'
              return (
                <Table.Tr key={trade.id}>
                  <Table.Td>
                    <Stack gap={0}>
                      <Text size="sm" fw={500}>
                        {trade.filerName}
                      </Text>
                      {trade.filerTitle && (
                        <Text size="xs" c="slate.7">
                          {trade.filerTitle}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="sm"
                      color={typeColor(trade.transactionType)}
                      variant="light"
                    >
                      {label}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" ff="monospace">
                      {formatShares(trade.shares)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" ff="monospace">
                      {formatDollarsCompact(trade.totalValue)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="xs" c="slate.7">
                      {formatDate(trade.transactionDate)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Card>
      {overflow > 0 && (
        <Text size="xs" c="slate.6" ta="center">
          Showing {visible.length} of {trades.length} trades.
        </Text>
      )}
    </Stack>
  )
}
