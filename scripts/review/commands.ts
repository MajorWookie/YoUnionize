// Command implementations. Each accepts the parsed args + a logger and
// returns when done (or throws on failure). The dispatcher in index.ts is
// responsible for argv parsing and error formatting.

import {
  getActiveSession,
  login as authLogin,
  logout as authLogout,
  whoami as authWhoami,
} from './auth'
import { ApiError, ReviewApiClient } from './client'
import { editJson, EditAbortedError, EditParseError } from './editor'
import { renderDetail, renderEditOutcome, renderListTable } from './format'
import type { ReviewLogger } from './logger'

interface CommandContext {
  logger: ReviewLogger
  positional: ReadonlyArray<string>
  flags: Readonly<Record<string, string | boolean | undefined>>
}

// ── login / logout / whoami ────────────────────────────────────────────────

export async function loginCmd(_: CommandContext): Promise<void> {
  const session = await authLogin()
  console.info(`Logged in as ${session.email} (${session.userId})`)
}

export async function logoutCmd(_: CommandContext): Promise<void> {
  await authLogout()
  console.info('Logged out.')
}

export async function whoamiCmd(_: CommandContext): Promise<void> {
  const me = await authWhoami()
  if (!me) {
    console.info('Not logged in.')
    process.exit(1)
  }
  console.info(`${me.email} (${me.userId})`)
}

// ── list / show ────────────────────────────────────────────────────────────

export async function listCmd(ctx: CommandContext): Promise<void> {
  const api = await ReviewApiClient.create()
  const ticker = ctx.flags.ticker as string | undefined
  const status = ctx.flags.status as string | undefined
  const limit = ctx.flags.limit as string | undefined

  const result = await api.call<{ items: ReadonlyArray<ListRow>; count: number }>(
    'review-list',
    {
      method: 'GET',
      query: { ticker, status, limit },
      logger: ctx.logger,
      scope: 'list',
    },
  )

  console.info(renderListTable(result.items))
  console.info(`\n${result.count} item(s).`)
}

interface ListRow {
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

export async function showCmd(ctx: CommandContext): Promise<void> {
  const id = requirePositional(ctx, 'show', 0, 'filing-id')
  const api = await ReviewApiClient.create()
  const result = await api.call<{ item: ItemShape; diff: DiffShape }>('review-get', {
    method: 'GET',
    query: { id },
    logger: ctx.logger,
    scope: 'show',
  })
  console.info(renderDetail(result.item, result.diff))
}

interface ItemShape {
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

interface DiffShape {
  changeRatio: number
  humanAuthoredThreshold: number
  wouldBeAuthored: boolean
}

// ── edit-raw ───────────────────────────────────────────────────────────────

export async function editRawCmd(ctx: CommandContext): Promise<void> {
  const id = requirePositional(ctx, 'edit-raw', 0, 'filing-id')
  const api = await ReviewApiClient.create()
  ctx.logger.info('edit-raw', 'Loading filing', { id })

  const { item } = await api.call<{ item: ItemShape }>('review-get', {
    method: 'GET',
    query: { id },
    logger: ctx.logger,
    scope: 'edit-raw',
  })

  // Edit the override if present, else start from raw_data.
  const initial = item.rawDataOverride ?? item.rawData
  ctx.logger.info('edit-raw', 'Opening editor', {
    sourceKeys: Object.keys(initial as Record<string, unknown>),
  })

  let edited: Record<string, unknown>
  try {
    edited = await editJson<Record<string, unknown>>(initial, {
      filename: `raw-${item.companyTicker}-${item.accessionNumber}.json`,
      header: [
        `Editing raw data for ${item.companyTicker} ${item.filingType} (${item.accessionNumber}).`,
        `Save and close to apply. Save empty or close without changes to abort.`,
        `This will set summary_version=0 — summarization will re-run on next pass.`,
      ],
    })
  } catch (err) {
    if (err instanceof EditAbortedError) {
      console.info('Edit aborted; no changes saved.')
      return
    }
    if (err instanceof EditParseError) {
      console.error(`Edit rejected: ${err.message}`)
      process.exit(1)
    }
    throw err
  }

  await api.call('review-raw-override', {
    method: 'POST',
    body: {
      filingId: item.id,
      override: edited,
      expectedLockVersion: item.optimisticLockVersion,
    },
    logger: ctx.logger,
    scope: 'edit-raw',
  })
  console.info(
    `Override saved. summary_version reset to 0 — re-run summarization to refresh the AI summary.`,
  )
}

// ── summarize ──────────────────────────────────────────────────────────────

export async function summarizeCmd(ctx: CommandContext): Promise<void> {
  const ticker = requirePositional(ctx, 'summarize', 0, 'ticker').toUpperCase()
  const api = await ReviewApiClient.create()

  ctx.logger.forTicker(ticker).info('summarize', 'Enqueueing job', { ticker })
  const result = await api.call<{ jobId: string; company: { ticker: string; name: string; id: string } }>(
    'company-summarize',
    {
      method: 'POST',
      query: { ticker },
      logger: ctx.logger,
      scope: 'summarize',
    },
  )
  console.info(
    `Summarization job ${result.jobId} enqueued for ${result.company.ticker} (${result.company.name}).`,
  )
  console.info(
    `Poll: bun run review job-status ${result.jobId}   (or hit /functions/v1/job-status?id=${result.jobId})`,
  )
}

// ── edit-summary ───────────────────────────────────────────────────────────

export async function editSummaryCmd(ctx: CommandContext): Promise<void> {
  const id = requirePositional(ctx, 'edit-summary', 0, 'filing-id')
  const api = await ReviewApiClient.create()

  const { item, diff } = await api.call<{ item: ItemShape; diff: DiffShape }>(
    'review-get',
    { method: 'GET', query: { id }, logger: ctx.logger, scope: 'edit-summary' },
  )

  const initial = item.humanSummary ?? item.aiSummary ?? {}
  if (!item.aiSummary) {
    console.info(
      'No AI baseline found; you are authoring this summary from scratch (status will be Human Authored).',
    )
  }

  let edited: Record<string, unknown>
  try {
    edited = await editJson<Record<string, unknown>>(initial, {
      filename: `summary-${item.companyTicker}-${item.accessionNumber}.json`,
      header: [
        `Editing summary for ${item.companyTicker} ${item.filingType} (${item.accessionNumber}).`,
        `Status will be set based on value-only diff vs the AI baseline:`,
        `  • <80% changed → Human Edited`,
        `  • ≥80% changed → Human Authored`,
        `Current change ratio: ${(diff.changeRatio * 100).toFixed(1)}%`,
      ],
    })
  } catch (err) {
    if (err instanceof EditAbortedError) {
      console.info('Edit aborted; no changes saved.')
      return
    }
    if (err instanceof EditParseError) {
      console.error(`Edit rejected: ${err.message}`)
      process.exit(1)
    }
    throw err
  }

  const result = await api.call<{
    status: string
    changeRatio?: number
    humanAuthoredThreshold?: number
  }>('review-summary', {
    method: 'POST',
    body: {
      filingId: item.id,
      humanSummary: edited,
      expectedLockVersion: item.optimisticLockVersion,
    },
    logger: ctx.logger,
    scope: 'edit-summary',
  })
  console.info(renderEditOutcome(result))
}

// ── verify ─────────────────────────────────────────────────────────────────

export async function verifyCmd(ctx: CommandContext): Promise<void> {
  const id = requirePositional(ctx, 'verify', 0, 'filing-id')
  const api = await ReviewApiClient.create()
  const session = await getActiveSession()

  // Need the lock version. Could load via review-get, but verify is light;
  // a single round trip is fine.
  const { item } = await api.call<{ item: ItemShape }>('review-get', {
    method: 'GET',
    query: { id },
    logger: ctx.logger,
    scope: 'verify',
  })

  await api.call('review-verify', {
    method: 'POST',
    body: { filingId: item.id, expectedLockVersion: item.optimisticLockVersion },
    logger: ctx.logger,
    scope: 'verify',
  })
  console.info(`Verified ${item.id} — status set to Human Verified by ${session.email}.`)
}

// ── helpers ────────────────────────────────────────────────────────────────

function requirePositional(
  ctx: CommandContext,
  cmd: string,
  index: number,
  name: string,
): string {
  const v = ctx.positional[index]
  if (!v) {
    console.error(`Usage: bun run review ${cmd} <${name}>`)
    process.exit(2)
  }
  return v
}

export { ApiError }
