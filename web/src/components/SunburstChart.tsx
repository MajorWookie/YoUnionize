/**
 * Multi-ring sunburst/donut chart rendered with browser SVG. Geometry +
 * arc math ported verbatim from the iOS SunburstChart component
 * (src/interface/charts/SunburstChart.tsx); only the SVG primitives and
 * theme accessors differ.
 *
 * Supports:
 * - 1–3 concentric rings with configurable radii
 * - Constrained inner rings (ring 3 only spans the angular range of a parent slice)
 * - Minimum visible arc width for very small slices
 * - Click interaction on each slice (calls onSliceClick)
 * - Active slice highlighting (increased opacity, thicker stroke)
 * - Center label for the total value
 */
import { useMemo } from 'react'
import { useMantineTheme } from '@mantine/core'
import type {
  SunburstRing,
  SunburstSlice,
} from '~/lib/income-data-extractor'

interface RingLayout {
  innerRadius: number
  outerRadius: number
}

export interface SunburstChartProps {
  rings: Array<SunburstRing>
  size?: number
  centerValue?: string
  centerLabel?: string
  activeSliceId?: string | null
  onSliceClick?: (slice: SunburstSlice, ringIndex: number) => void
}

const MIN_ARC_DEG = 7.2
const SLICE_GAP = 1.2

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle
  if (sweep < 0.1) return ''
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

interface ComputedArc {
  slice: SunburstSlice
  startAngle: number
  endAngle: number
  ringIndex: number
}

function enforceMinimums(
  angles: Array<number>,
  min: number,
  budget: number,
): Array<number> {
  const result = [...angles]
  let deficit = 0
  for (let i = 0; i < result.length; i++) {
    if (result[i] < min) {
      deficit += min - result[i]
      result[i] = min
    }
  }
  if (deficit <= 0) return result
  const largeIndices = result
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v > min)
    .sort((a, b) => b.v - a.v)
  const largeTotal = largeIndices.reduce((s, x) => s + x.v, 0)
  for (const { i } of largeIndices) {
    const share = (result[i] / largeTotal) * deficit
    result[i] = Math.max(result[i] - share, min)
  }
  // Note: `budget` is kept in the signature for parity with the iOS version
  // but isn't currently re-balanced against — caller inspects results directly.
  void budget
  return result
}

function computeArcs(rings: Array<SunburstRing>): Array<ComputedArc> {
  const arcs: Array<ComputedArc> = []
  const unconstrainedCount = rings.filter((r) => !r.constrainedToSliceId).length
  const hasConstrained = rings.some((r) => r.constrainedToSliceId)
  const constrainedLayoutIndex = hasConstrained ? unconstrainedCount : -1

  let unconstrainedIdx = 0
  const layoutIndexMap = new Map<number, number>()
  for (let ri = 0; ri < rings.length; ri++) {
    if (rings[ri].constrainedToSliceId) {
      layoutIndexMap.set(ri, constrainedLayoutIndex)
    } else {
      layoutIndexMap.set(ri, unconstrainedIdx++)
    }
  }

  const parentArcs = new Map<string, { start: number; end: number }>()

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri]
    if (ring.constrainedToSliceId) continue

    const total = ring.slices.reduce((s, sl) => s + sl.value, 0)
    if (total <= 0) continue

    const totalGap = ring.slices.length * SLICE_GAP
    const availableDeg = 360 - totalGap
    const rawAngles = ring.slices.map(
      (sl) => (sl.value / total) * availableDeg,
    )
    const adjusted = enforceMinimums(rawAngles, MIN_ARC_DEG, availableDeg)

    let angle = 0
    for (let si = 0; si < ring.slices.length; si++) {
      const start = angle
      const end = angle + adjusted[si]
      arcs.push({
        slice: ring.slices[si],
        startAngle: start,
        endAngle: end,
        ringIndex: layoutIndexMap.get(ri) ?? ri,
      })
      parentArcs.set(ring.slices[si].id, { start, end })
      angle = end + SLICE_GAP
    }
  }

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

    const rawAngles = ring.slices.map(
      (sl) => (sl.value / total) * availableDeg,
    )
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
        ringIndex: layoutIndexMap.get(ri) ?? ri,
      })
      angle = end + SLICE_GAP
    }
  }

  return arcs
}

function computeRingLayouts(
  rings: Array<SunburstRing>,
  chartRadius: number,
): Array<RingLayout> {
  const unconstrainedCount = rings.filter((r) => !r.constrainedToSliceId).length
  const hasConstrained = rings.some((r) => r.constrainedToSliceId)
  const visualCount = unconstrainedCount + (hasConstrained ? 1 : 0)

  const centerRadius = chartRadius * 0.38
  const ringSpace = chartRadius - centerRadius
  const ringWidth = ringSpace / visualCount - 3

  const layouts: Array<RingLayout> = []
  for (let i = 0; i < visualCount; i++) {
    const outerR = chartRadius - i * (ringWidth + 3)
    const innerR = outerR - ringWidth
    layouts.push({
      innerRadius: Math.max(innerR, centerRadius),
      outerRadius: outerR,
    })
  }
  return layouts
}

export function SunburstChart({
  rings,
  size = 300,
  centerValue,
  centerLabel,
  activeSliceId,
  onSliceClick,
}: SunburstChartProps) {
  const theme = useMantineTheme()
  const cx = size / 2
  const cy = size / 2
  const chartRadius = size / 2 - 4

  const arcs = useMemo(() => computeArcs(rings), [rings])
  const ringLayouts = useMemo(
    () => computeRingLayouts(rings, chartRadius),
    [rings, chartRadius],
  )

  const strokeColor = theme.colors.slate?.[2] ?? '#e9ecef'
  const labelColor = theme.colors.slate?.[9] ?? '#212529'
  const sublabelColor = theme.colors.slate?.[6] ?? '#868e96'

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', margin: '0 auto' }}
    >
      {arcs.map((arc) => {
        const layout = ringLayouts[arc.ringIndex]
        if (!layout) return null

        const isActive = activeSliceId === arc.slice.id
        const isDimmed = activeSliceId != null && !isActive

        const activeOffset = isActive ? 3 : 0
        const innerR = layout.innerRadius - activeOffset * 0.5
        const outerR = layout.outerRadius + activeOffset

        const d = annularSectorPath(
          cx,
          cy,
          innerR,
          outerR,
          arc.startAngle,
          arc.endAngle,
        )
        if (!d) return null

        const isClickable = !!onSliceClick
        return (
          <path
            key={`${arc.ringIndex}-${arc.slice.id}`}
            d={d}
            fill={arc.slice.color}
            fillOpacity={isDimmed ? 0.35 : isActive ? 1 : 0.85}
            stroke={isActive ? '#ffffff' : strokeColor}
            strokeWidth={isActive ? 2 : 0.8}
            onClick={
              onSliceClick
                ? () => onSliceClick(arc.slice, arc.ringIndex)
                : undefined
            }
            style={{ cursor: isClickable ? 'pointer' : 'default' }}
          />
        )
      })}

      {centerValue && (
        <>
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            fontSize={16}
            fontWeight={700}
            fill={labelColor}
          >
            {centerValue}
          </text>
          {centerLabel && (
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              fontSize={10}
              fill={sublabelColor}
            >
              {centerLabel}
            </text>
          )}
        </>
      )}
    </svg>
  )
}
