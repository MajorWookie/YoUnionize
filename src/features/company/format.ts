/**
 * Financial number formatting utilities.
 * Monetary values in the database are stored in cents.
 */

/** Format cents to readable dollar string */
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '-'
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`
  if (Math.abs(dollars) >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`
  if (Math.abs(dollars) >= 1e3) return `$${(dollars / 1e3).toFixed(0)}K`
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/** Format a raw number (not cents) for financial statements */
export function formatFinancial(value: number | null | undefined): string {
  if (value == null) return '-'
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Format a percentage with sign */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/** Format a number of shares */
export function formatShares(shares: string | number | null | undefined): string {
  if (shares == null) return '-'
  const n = typeof shares === 'string' ? Number.parseFloat(shares) : shares
  if (Number.isNaN(n)) return '-'
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString('en-US')
}

/** Format a date string to short readable form */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Get initials from a name (first letter of first and last name) */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}
