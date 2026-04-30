import { RingProgress, Stack, Text } from '@mantine/core'

export function FairnessGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = scoreColor(clamped)
  const label = scoreLabel(clamped)
  return (
    <Stack gap="xs" align="center">
      <RingProgress
        size={180}
        thickness={16}
        roundCaps
        sections={[{ value: clamped, color }]}
        label={
          <Stack gap={0} align="center">
            <Text size="32px" fw={700} lh={1}>
              {clamped}
            </Text>
            <Text size="xs" c="slate.7">
              of 100
            </Text>
          </Stack>
        }
      />
      <Text fw={600} c={color}>
        {label}
      </Text>
    </Stack>
  )
}

function scoreColor(score: number): string {
  if (score >= 80) return 'navy.6'
  if (score >= 60) return 'green.6'
  if (score >= 40) return 'yellow.6'
  return 'red.6'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Below Average'
  return 'Underpaid'
}
