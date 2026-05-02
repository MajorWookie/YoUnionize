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

/**
 * Social-feed-style relative timestamp ("3d ago", "12h ago"). Falls back to
 * the absolute date once the event is older than ~2 weeks, since "27d ago"
 * stops being intuitive. Never returns "in N…" for future timestamps —
 * those clamp to "just now".
 */
export function formatRelativeTime(input: string | null | undefined, now: number = Date.now()): string {
  if (!input) return '–'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input

  const diffMs = now - d.getTime()
  if (diffMs < 60_000) return 'just now'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`

  return formatDate(input)
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
