import { Box, Group, Stack, Text } from '@mantine/core'

export type WaterfallItem = {
  label: string
  amount: number
  formattedAmount: string
  type: 'income' | 'expense' | 'result'
}

export function WaterfallChart({
  items,
}: {
  items: ReadonlyArray<WaterfallItem>
}) {
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.amount)), 1)

  return (
    <Stack gap="md">
      {items.map((item, idx) => {
        const widthPct = (Math.abs(item.amount) / maxAbs) * 100
        const color =
          item.type === 'income'
            ? 'navy.6'
            : item.type === 'expense'
              ? 'red.5'
              : item.amount >= 0
                ? 'green.6'
                : 'red.6'
        return (
          <Stack key={idx} gap={6}>
            <Group justify="space-between" gap="xs">
              <Text size="sm" fw={500}>
                {item.label}
              </Text>
              <Text size="sm" fw={600}>
                {item.formattedAmount}
              </Text>
            </Group>
            <Box
              bg="slate.2"
              h={10}
              style={{ borderRadius: 5, overflow: 'hidden' }}
            >
              <Box bg={color} h="100%" style={{ width: `${widthPct}%` }} />
            </Box>
          </Stack>
        )
      })}
    </Stack>
  )
}
