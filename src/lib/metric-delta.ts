export interface MetricDelta {
  value: string
  direction: 'up' | 'down' | 'flat'
}

export function metricDelta(changePercent: number | null): MetricDelta | undefined {
  if (changePercent == null) return undefined
  const direction =
    changePercent > 0.05
      ? 'up'
      : changePercent < -0.05
        ? 'down'
        : 'flat'
  const sign = changePercent > 0 ? '+' : ''
  return {
    value: `${sign}${changePercent.toFixed(1)}% YoY`,
    direction,
  }
}
