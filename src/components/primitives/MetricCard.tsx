import { Card, Stack, Text } from '@mantine/core'
import { IconMinus, IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface DeltaSpec {
  value: ReactNode
  direction: 'up' | 'down' | 'flat'
}

interface MetricCardProps {
  label: ReactNode
  value: ReactNode
  /** Optional change indicator with directional icon + colored value. */
  delta?: DeltaSpec
  /** Optional supporting line below the metric. */
  hint?: ReactNode
}

const DELTA_COLOR: Record<DeltaSpec['direction'], string> = {
  up: 'green.7',
  down: 'red.7',
  flat: 'slate.6',
}

const DELTA_ICON = {
  up: IconTrendingUp,
  down: IconTrendingDown,
  flat: IconMinus,
} as const

export function MetricCard({ label, value, delta, hint }: MetricCardProps) {
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null
  const deltaColor = delta ? DELTA_COLOR[delta.direction] : undefined

  return (
    <Card>
      <Stack gap="xs">
        <Text c="dimmed" size="xs" fw={600} tt="uppercase" lts="0.04em">
          {label}
        </Text>
        <Text
          fz="32px"
          fw={700}
          lh={1.1}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Text>
        {delta && DeltaIcon ? (
          <Text
            size="sm"
            c={deltaColor}
            fw={600}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <DeltaIcon size={14} stroke={2} />
            <span>{delta.value}</span>
          </Text>
        ) : null}
        {hint ? (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Card>
  )
}
