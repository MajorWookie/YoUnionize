/**
 * Cross-platform SVG pie chart using react-native-svg.
 * Renders a donut chart with labeled segments and a center label.
 */
import Svg, { G, Path, Text as SvgText } from 'react-native-svg'
import { Paragraph, View, XStack, YStack } from 'tamagui'

export interface PieSegment {
  label: string
  value: number
  formattedValue: string
  color: string
}

interface PieChartProps {
  segments: Array<PieSegment>
  /** Total value label shown in the center of the donut */
  centerLabel?: string
  centerValue?: string
  /** Outer radius of the chart */
  size?: number
  /** Width of the donut ring (0 = full pie) */
  strokeWidth?: number
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

export function PieChart({
  segments,
  centerLabel,
  centerValue,
  size = 200,
  strokeWidth = 32,
}: PieChartProps) {
  const filtered = segments.filter((s) => s.value > 0)
  if (filtered.length === 0) return null

  const total = filtered.reduce((sum, s) => sum + s.value, 0)
  const cx = size / 2
  const cy = size / 2
  const radius = (size - strokeWidth) / 2

  let currentAngle = 0
  const arcs = filtered.map((seg) => {
    const sweep = (seg.value / total) * 360
    // Prevent full-circle arc rendering issue by capping at 359.99
    const clampedSweep = Math.min(sweep, 359.99)
    const startAngle = currentAngle
    const endAngle = currentAngle + clampedSweep
    currentAngle += sweep

    return {
      ...seg,
      startAngle,
      endAngle,
      percent: ((seg.value / total) * 100).toFixed(1),
    }
  })

  return (
    <YStack alignItems="center" gap="$3">
      <View width={size} height={size}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <G>
            {arcs.map((arc) => (
              <Path
                key={arc.label}
                d={arcPath(cx, cy, radius, arc.startAngle, arc.endAngle)}
                stroke={arc.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="butt"
              />
            ))}
          </G>
          {centerValue && (
            <>
              <SvgText
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                fontSize={18}
                fontWeight="700"
                fill="#e8e8e8"
              >
                {centerValue}
              </SvgText>
              {centerLabel && (
                <SvgText
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#999"
                >
                  {centerLabel}
                </SvgText>
              )}
            </>
          )}
        </Svg>
      </View>

      {/* Legend */}
      <YStack gap="$1.5" width="100%">
        {arcs.map((arc) => (
          <XStack key={arc.label} alignItems="center" justifyContent="space-between">
            <XStack alignItems="center" gap="$2" flex={1}>
              <View
                width={10}
                height={10}
                borderRadius={2}
                backgroundColor={arc.color}
              />
              <Paragraph fontSize={13} color="$color11" numberOfLines={1}>
                {arc.label}
              </Paragraph>
            </XStack>
            <XStack gap="$2" alignItems="center">
              <Paragraph fontSize={13} fontWeight="600" color="$color12">
                {arc.formattedValue}
              </Paragraph>
              <Paragraph fontSize={12} color="$color8" width={45} textAlign="right">
                {arc.percent}%
              </Paragraph>
            </XStack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}
