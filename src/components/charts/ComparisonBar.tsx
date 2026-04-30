import { Box, Group, Stack, Text } from '@mantine/core'

interface Props {
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
  leftColor = 'green.6',
  rightColor = 'red.5',
}: Props) {
  const total = leftValue + rightValue
  const leftPct = total > 0 ? (leftValue / total) * 100 : 50
  const rightPct = total > 0 ? (rightValue / total) * 100 : 50

  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Stack gap={0}>
          <Text size="xs" c="slate.7">
            {leftLabel}
          </Text>
          <Text size="sm" fw={600}>
            {leftFormatted}
          </Text>
        </Stack>
        <Stack gap={0} align="flex-end">
          <Text size="xs" c="slate.7">
            {rightLabel}
          </Text>
          <Text size="sm" fw={600}>
            {rightFormatted}
          </Text>
        </Stack>
      </Group>
      <Box
        h={12}
        style={{
          display: 'flex',
          borderRadius: 6,
          overflow: 'hidden',
          backgroundColor: 'var(--mantine-color-slate-2)',
        }}
      >
        <Box bg={leftColor} style={{ width: `${leftPct}%` }} />
        <Box bg={rightColor} style={{ width: `${rightPct}%` }} />
      </Box>
    </Stack>
  )
}
