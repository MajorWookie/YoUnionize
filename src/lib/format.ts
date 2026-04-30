/**
 * Display formatters used across dashboard sections. Mirrors the iOS
 * counterparts so the two platforms render identical strings.
 */

const compactDollars = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const fullDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatDollarsCompact(n: number | null | undefined): string {
  if (n == null) return '–'
  return `$${compactDollars.format(n)}`
}

export function formatDollarsFull(n: number | null | undefined): string {
  if (n == null) return '–'
  return fullDollars.format(n)
}

export function formatShares(value: string | null | undefined): string {
  if (!value) return '–'
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

export function formatDate(input: string | null | undefined): string {
  if (!input) return '–'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return '–'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
