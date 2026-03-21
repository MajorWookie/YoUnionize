/**
 * Multi-ring sunburst/donut chart rendered with react-native-svg.
 *
 * Supports:
 * - 1–3 concentric rings with configurable radii
 * - Constrained inner rings (ring 3 only spans the angular range of a parent slice)
 * - Minimum visible arc width for very small slices
 * - Tap interaction on each slice (calls onSlicePress)
 * - Active slice highlighting (increased opacity, thicker stroke)
 * - Center label for the total value
 */
import { useMemo } from 'react'
import Svg, { G, Path, Text as SvgText } from 'react-native-svg'
import { View } from 'tamagui'
import type { SunburstRing, SunburstSlice } from '~/features/company/lib/income-data-extractor'

// ── Types ──────────────────────────────────────────────────────────────

interface RingLayout {
  innerRadius: number
  outerRadius: number
}

export interface SunburstChartProps {
  rings: SunburstRing[]
  /** Size of the chart (width and height) */
  size?: number
  /** Center label (typically the total value) */
  centerValue?: string
  centerLabel?: string
  /** Currently active slice id (highlighted) */
  activeSliceId?: string | null
  /** Called when a slice is tapped */
  onSlicePress?: (slice: SunburstSlice, ringIndex: number) => void
}

// ── Geometry helpers ───────────────────────────────────────────────────

/** Minimum arc width in degrees to keep tiny slices visible */
const MIN_ARC_DEG = 7.2 // 2% of 360°
/** Gap between slices in degrees */
const SLICE_GAP = 1.2

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * SVG path for an annular sector (filled wedge of a ring).
 * Sweeps clockwise from startAngle to endAngle.
 */
function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle
  if (sweep < 0.1) return '' // too small to render

  // Clamp to prevent full-circle rendering issue
  const clampedEnd = startAngle + Math.min(sweep, 359.9)

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle)
  const outerEnd = polarToCartesian(cx, cy, outerR, clampedEnd)
  const innerEnd = polarToCartesian(cx, cy, innerR, clampedEnd)
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle)
  const largeArc = sweep > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

// ── Angle computation ──────────────────────────────────────────────────

interface ComputedArc {
  slice: SunburstSlice
  startAngle: number
  endAngle: number
  ringIndex: number
}

/**
 * Compute arc angles for all slices across all rings.
 * Ring 3 (if constrained) only spans the angular range of its parent slice in Ring 2.
 */
function computeArcs(rings: SunburstRing[]): ComputedArc[] {
  const arcs: ComputedArc[] = []

  // First pass: compute Ring 1 and Ring 2 (full circle, 0-360)
  const parentArcs = new Map<string, { start: number; end: number }>()

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri]
    if (ring.constrainedToSliceId) continue // handle constrained rings in second pass

    const total = ring.slices.reduce((s, sl) => s + sl.value, 0)
    if (total <= 0) continue

    // Apply minimum arc width: redistribute proportionally
    const minDeg = MIN_ARC_DEG
    const totalGap = ring.slices.length * SLICE_GAP
    const availableDeg = 360 - totalGap
    const rawAngles = ring.slices.map((sl) => (sl.value / total) * availableDeg)

    // Enforce minimum and redistribute
    const adjusted = enforceMinimums(rawAngles, minDeg, availableDeg)

    let angle = 0
    for (let si = 0; si < ring.slices.length; si++) {
      const start = angle
      const end = angle + adjusted[si]
      arcs.push({
        slice: ring.slices[si],
        startAngle: start,
        endAngle: end,
        ringIndex: ri,
      })
      parentArcs.set(ring.slices[si].id, { start, end })
      angle = end + SLICE_GAP
    }
  }

  // Second pass: constrained rings (Ring 3)
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri]
    if (!ring.constrainedToSliceId) continue

    const parent = parentArcs.get(ring.constrainedToSliceId)
    if (!parent) continue

    const parentSpan = parent.end - parent.start
    const total = ring.slices.reduce((s, sl) => s + sl.value, 0)
    if (total <= 0 || parentSpan <= 0) continue

    const totalGap = ring.slices.length * SLICE_GAP
    const availableDeg = parentSpan - totalGap
    if (availableDeg <= 0) continue

    const rawAngles = ring.slices.map((sl) => (sl.value / total) * availableDeg)
    const minInner = Math.min(MIN_ARC_DEG, parentSpan / ring.slices.length / 2)
    const adjusted = enforceMinimums(rawAngles, minInner, availableDeg)

    let angle = parent.start
    for (let si = 0; si < ring.slices.length; si++) {
      const start = angle
      const end = angle + adjusted[si]
      arcs.push({
        slice: ring.slices[si],
        startAngle: start,
        endAngle: end,
        ringIndex: ri,
      })
      angle = end + SLICE_GAP
    }
  }

  return arcs
}

/** Enforce minimum arc angles while preserving total budget */
function enforceMinimums(angles: number[], min: number, budget: number): number[] {
  const result = [...angles]
  let deficit = 0

  // First pass: identify slices below minimum
  for (let i = 0; i < result.length; i++) {
    if (result[i] < min) {
      deficit += min - result[i]
      result[i] = min
    }
  }

  if (deficit <= 0) return result

  // Second pass: redistribute deficit proportionally from larger slices
  const largeIndices = result
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v > min)
    .sort((a, b) => b.v - a.v)

  const largeTotal = largeIndices.reduce((s, x) => s + x.v, 0)
  for (const { i } of largeIndices) {
    const share = (result[i] / largeTotal) * deficit
    result[i] = Math.max(result[i] - share, min)
  }

  return result
}

// ── Ring layout ────────────────────────────────────────────────────────

function computeRingLayouts(ringCount: number, chartRadius: number): RingLayout[] {
  const centerRadius = chartRadius * 0.38
  const ringSpace = chartRadius - centerRadius
  const ringWidth = ringSpace / ringCount - 3

  const layouts: RingLayout[] = []
  for (let i = 0; i < ringCount; i++) {
    // Ring 0 is outermost, last ring is innermost
    const outerR = chartRadius - i * (ringWidth + 3)
    const innerR = outerR - ringWidth
    layouts.push({ innerRadius: Math.max(innerR, centerRadius), outerRadius: outerR })
  }
  return layouts
}

// ── Component ──────────────────────────────────────────────────────────

export function SunburstChart({
  rings,
  size = 300,
  centerValue,
  centerLabel,
  activeSliceId,
  onSlicePress,
}: SunburstChartProps) {
  const cx = size / 2
  const cy = size / 2
  const chartRadius = size / 2 - 4

  const arcs = useMemo(() => computeArcs(rings), [rings])
  const ringLayouts = useMemo(
    () => computeRingLayouts(rings.length, chartRadius),
    [rings.length, chartRadius],
  )

  return (
    <View width={size} height={size} self="center">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((arc) => {
          const layout = ringLayouts[arc.ringIndex]
          if (!layout) return null

          const isActive = activeSliceId === arc.slice.id
          const isDimmed = activeSliceId != null && !isActive

          // Scale the ring slightly outward when active
          const activeOffset = isActive ? 3 : 0
          const innerR = layout.innerRadius - activeOffset * 0.5
          const outerR = layout.outerRadius + activeOffset

          const d = annularSectorPath(cx, cy, innerR, outerR, arc.startAngle, arc.endAngle)
          if (!d) return null

          return (
            <Path
              key={`${arc.ringIndex}-${arc.slice.id}`}
              d={d}
              fill={arc.slice.color}
              fillOpacity={isDimmed ? 0.35 : isActive ? 1 : 0.85}
              stroke={isActive ? '#ffffff' : '#1a1a2e'}
              strokeWidth={isActive ? 2 : 0.8}
              onPress={() => onSlicePress?.(arc.slice, arc.ringIndex)}
            />
          )
        })}

        {/* Center label */}
        {centerValue && (
          <>
            <SvgText
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              fontSize={16}
              fontWeight="700"
              fill="#e8e8e8"
            >
              {centerValue}
            </SvgText>
            {centerLabel && (
              <SvgText
                x={cx}
                y={cy + 12}
                textAnchor="middle"
                fontSize={10}
                fill="#999"
              >
                {centerLabel}
              </SvgText>
            )}
          </>
        )}
      </Svg>
    </View>
  )
}
