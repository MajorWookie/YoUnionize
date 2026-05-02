import { RingProgress, Stack, Text } from '@mantine/core'

interface FairnessGaugeProps {
  score: number
  /** Outer diameter in pixels. Defaults to 180; the My Pay verdict hero
   *  uses 240. Internal proportions (ring thickness, label sizing) scale
   *  with this value. */
  size?: number
}

export function FairnessGauge({ score, size = 180 }: FairnessGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = scoreColor(clamped)
  const label = scoreLabel(clamped)

  // Scale interior treatment with size so the hero variant doesn't look
  // like a default gauge that someone scaled up — the ring should feel
  // proportional and the number should anchor visually.
  const thickness = Math.max(12, Math.round(size * 0.09))
  const numFontPx = Math.round(size * 0.18)

  return (
    <Stack gap="xs" align="center">
      <RingProgress
        size={size}
        thickness={thickness}
        roundCaps
        sections={[{ value: clamped, color }]}
        label={
          <Stack gap={0} align="center">
            <Text
              fz={`${numFontPx}px`}
              fw={700}
              lh={1}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {clamped}
            </Text>
            <Text size="xs" c="dimmed">
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
  if (score >= 40) return 'amber.6'
  return 'red.6'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Below average'
  return 'Underpaid'
}
