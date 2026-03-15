/**
 * Circular gauge for the fairness score (1-100).
 * Renders a ring with a colored arc and the score in the center.
 * Uses Tamagui View + inline SVG for web, falls back to a simple visual on native.
 */
import { Paragraph, View, YStack } from 'tamagui'

interface FairnessGaugeProps {
  /** Score from 1-100 */
  score: number
  /** Diameter in pixels */
  size?: number
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#3a6cbb' // blue — above fair
  if (score >= 60) return '#069639' // green — fair
  if (score >= 40) return '#d69e2e' // yellow — needs review
  return '#e53e3e' // red — below fair
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Above Fair'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Needs Review'
  return 'Below Fair'
}

export function FairnessGauge({ score, size = 180 }: FairnessGaugeProps) {
  const color = getScoreColor(score)
  const label = getScoreLabel(score)
  const clampedScore = Math.max(0, Math.min(100, score))

  // Ring parameters
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (clampedScore / 100) * circumference
  const offset = circumference - progress

  return (
    <YStack alignItems="center" gap="$2">
      <View width={size} height={size} alignItems="center" justifyContent="center">
        {/* SVG ring — works on web */}
        {typeof window !== 'undefined' ? (
          <View
            width={size}
            height={size}
            position="absolute"
            // biome-ignore lint: need dangerouslySetInnerHTML for inline SVG
            dangerouslySetInnerHTML={{
              __html: `
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                  <circle
                    cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="var(--color4, #e2e8f0)" stroke-width="${strokeWidth}"
                  />
                  <circle
                    cx="${size / 2}" cy="${size / 2}" r="${radius}"
                    fill="none" stroke="${color}" stroke-width="${strokeWidth}"
                    stroke-linecap="round"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    transform="rotate(-90 ${size / 2} ${size / 2})"
                  />
                </svg>
              `,
            }}
          />
        ) : (
          /* Native fallback: colored ring background */
          <View
            width={size}
            height={size}
            borderRadius={size / 2}
            borderWidth={strokeWidth}
            borderColor={color}
            position="absolute"
            opacity={0.2}
          />
        )}

        {/* Score text in center */}
        <YStack alignItems="center" zIndex={1}>
          <Paragraph fontSize={size * 0.25} fontWeight="800" color={color}>
            {clampedScore}
          </Paragraph>
        </YStack>
      </View>

      <Paragraph fontWeight="700" fontSize={16} color={color}>
        {label}
      </Paragraph>
      <Paragraph color="$color8" fontSize={12}>
        Compensation Fairness Score
      </Paragraph>
    </YStack>
  )
}
