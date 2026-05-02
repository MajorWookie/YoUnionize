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
              ? 'terracotta.6'
              : item.amount >= 0
                ? 'green.6'
                : 'red.6'
        const isResult = item.type === 'result'
        return (
          <Stack key={idx} gap={6}>
            <Group justify="space-between" gap="xs">
              <Text size="sm" fw={isResult ? 600 : 500}>
                {item.label}
              </Text>
              <Text
                size="sm"
                fw={600}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {item.formattedAmount}
              </Text>
            </Group>
            <Box
              bg="slate.2"
              h={12}
              style={{
                borderRadius: 'var(--mantine-radius-xs)',
                overflow: 'hidden',
              }}
            >
              <Box
                bg={color}
                h="100%"
                style={{
                  width: `${widthPct}%`,
                  transition: 'width 200ms ease',
                }}
              />
            </Box>
          </Stack>
        )
      })}
    </Stack>
  )
}
