// CLI output formatters. Pure rendering — no IO.

interface ReviewListItem {
  id: string
  companyTicker: string
  companyName: string
  filingType: string
  accessionNumber: string
  filedAt: string
  summarizationStatus: string
  summarizationUpdatedAt: string
  summaryVersion: number
}

const STATUS_LABELS: Record<string, string> = {
  ai_generated: 'AI Generated',
  human_verified: 'Human Verified',
  human_edited: 'Human Edited',
  human_authored: 'Human Authored',
}

export function formatStatus(status: string, summaryVersion?: number): string {
  if (summaryVersion === -1) return 'Failed (retry needed)'
  return STATUS_LABELS[status] ?? status
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n)
  return s + ' '.repeat(n - s.length)
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function shortDate(iso: string): string {
  return iso.slice(0, 10)
}

export function renderListTable(items: ReadonlyArray<ReviewListItem>): string {
  if (items.length === 0) return 'No review items match the filter.'
  const cols = [
    { name: 'ID', width: 10 },
    { name: 'Ticker', width: 8 },
    { name: 'Type', width: 8 },
    { name: 'Filed', width: 12 },
    { name: 'Status', width: 22 },
    { name: 'Updated', width: 12 },
  ]
  const header = cols.map((c) => pad(c.name, c.width)).join(' ')
  const sep = cols.map((c) => '─'.repeat(c.width)).join(' ')
  const rows = items.map((it) =>
    [
      pad(shortId(it.id), 10),
      pad(it.companyTicker, 8),
      pad(it.filingType, 8),
      pad(shortDate(it.filedAt), 12),
      pad(formatStatus(it.summarizationStatus, it.summaryVersion), 22),
      pad(shortDate(it.summarizationUpdatedAt), 12),
    ].join(' '),
  )
  return [header, sep, ...rows].join('\n')
}

interface ReviewItem {
  id: string
  companyTicker: string
  companyName: string
  filingType: string
  accessionNumber: string
  filedAt: string
  periodEnd: string | null
  rawData: Record<string, unknown>
  rawDataOverride: Record<string, unknown> | null
  aiSummary: Record<string, unknown> | null
  humanSummary: Record<string, unknown> | null
  summaryVersion: number
  summarizationStatus: string
  summarizationUpdatedAt: string
  summarizationUpdatedBy: string | null
  optimisticLockVersion: number
}

interface DiffSummary {
  changeRatio: number
  humanAuthoredThreshold: number
  wouldBeAuthored: boolean
}

export function renderDetail(item: ReviewItem, diff: DiffSummary): string {
  const lines: Array<string> = []
  lines.push(`Filing:        ${item.companyTicker} (${item.companyName}) — ${item.filingType}`)
  lines.push(`ID:            ${item.id}`)
  lines.push(`Accession:     ${item.accessionNumber}`)
  lines.push(`Filed:         ${shortDate(item.filedAt)}`)
  lines.push(`Period end:    ${item.periodEnd ?? '—'}`)
  lines.push('')
  lines.push(`Status:        ${formatStatus(item.summarizationStatus, item.summaryVersion)}`)
  lines.push(`Summary ver:   ${item.summaryVersion}`)
  lines.push(`Updated at:    ${item.summarizationUpdatedAt}`)
  lines.push(`Updated by:    ${item.summarizationUpdatedBy ?? '—'}`)
  lines.push(`Lock version:  ${item.optimisticLockVersion}`)
  lines.push('')
  lines.push(`Raw override:  ${item.rawDataOverride ? 'present' : '—'}`)
  lines.push(`Human summary: ${item.humanSummary ? 'present' : '—'}`)
  lines.push(`AI summary:    ${item.aiSummary ? 'present' : '—'}`)
  if (item.humanSummary && item.aiSummary) {
    const pct = (diff.changeRatio * 100).toFixed(1)
    const threshold = (diff.humanAuthoredThreshold * 100).toFixed(0)
    lines.push(
      `Change ratio:  ${pct}% (≥${threshold}% would mark as Human Authored)`,
    )
  }
  return lines.join('\n')
}

/**
 * Returns a multi-line message describing what changed when a summary edit
 * was applied. Designed to be the immediate feedback the user sees after
 * `review edit-summary`.
 */
export function renderEditOutcome(result: {
  status: string
  changeRatio?: number
  humanAuthoredThreshold?: number
}): string {
  const lines = [`Status set to: ${formatStatus(result.status)}`]
  if (result.changeRatio !== undefined && result.humanAuthoredThreshold !== undefined) {
    const pct = (result.changeRatio * 100).toFixed(1)
    const threshold = (result.humanAuthoredThreshold * 100).toFixed(0)
    lines.push(`Change ratio:  ${pct}% (threshold ≥${threshold}%)`)
  }
  return lines.join('\n')
}
