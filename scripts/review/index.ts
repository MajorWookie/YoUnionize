// Entry point for `bun run review <subcommand>`.
//
// Usage examples:
//   bun run review login
//   bun run review whoami
//   bun run review list --status ai_generated --ticker AAPL
//   bun run review show <filing-id>
//   bun run review edit-raw <filing-id>
//   bun run review summarize AAPL
//   bun run review edit-summary <filing-id>
//   bun run review verify <filing-id>
//
// Common flags:
//   --verbose                 Enable per-run logging
//   --companies AAPL,TSLA     Filter logs to these tickers (use with --verbose)
//   --level trace|info|warn|error  Log level (default: info)

import { ApiError } from './client'
import {
  editRawCmd,
  editSummaryCmd,
  listCmd,
  loginCmd,
  logoutCmd,
  showCmd,
  summarizeCmd,
  verifyCmd,
  whoamiCmd,
} from './commands'
import { createReviewLogger, type LogLevel, type ReviewLogger } from './logger'

interface ParsedArgs {
  command: string | undefined
  positional: ReadonlyArray<string>
  flags: Readonly<Record<string, string | boolean>>
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
  const flags: Record<string, string | boolean> = {}
  const positional: Array<string> = []
  let command: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const name = arg.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[name] = true
      } else {
        flags[name] = next
        i++
      }
    } else if (!command) {
      command = arg
    } else {
      positional.push(arg)
    }
  }

  return { command, positional, flags }
}

function buildLogger(flags: Readonly<Record<string, string | boolean>>): ReviewLogger {
  const enabled = flags.verbose === true
  const level = (typeof flags.level === 'string' ? flags.level : 'info') as LogLevel
  const companiesRaw = typeof flags.companies === 'string' ? flags.companies : ''
  const companyFilter = companiesRaw.length > 0
    ? new Set(companiesRaw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
    : undefined
  return createReviewLogger({ enabled, level, companyFilter })
}

const COMMANDS: Record<string, (ctx: {
  logger: ReviewLogger
  positional: ReadonlyArray<string>
  flags: Readonly<Record<string, string | boolean | undefined>>
}) => Promise<void>> = {
  login: loginCmd,
  logout: logoutCmd,
  whoami: whoamiCmd,
  list: listCmd,
  show: showCmd,
  'edit-raw': editRawCmd,
  summarize: summarizeCmd,
  'edit-summary': editSummaryCmd,
  verify: verifyCmd,
}

function printHelp(): void {
  console.info(`bun run review <command> [args]

Commands:
  login                      Log in as a Supabase user (cached for future calls)
  logout                     Clear the cached session
  whoami                     Show the currently logged-in user

  list                       List filings pending review
    --ticker <SYM>           Filter to one company
    --status <s1,s2>         Filter by status (ai_generated|human_verified|human_edited|human_authored|failed)
    --limit <n>              Max rows (default 200)

  show <filing-id>           Show full review state for a filing

  edit-raw <filing-id>       Open $EDITOR on raw_data (or existing override)
                             — sets summary_version=0 to trigger re-run

  summarize <ticker>         Enqueue (re-)summarization for a company

  edit-summary <filing-id>   Open $EDITOR on the summary; status set from
                             value-only diff vs the AI baseline (≥80% = authored)

  verify <filing-id>         Mark the AI summary as Human Verified (no edit)

Common flags:
  --verbose                  Enable per-run logging
  --companies AAPL,TSLA      Filter logs to these tickers (with --verbose)
  --level trace|info|warn|error  Log level (default info)
`)
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2))

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    process.exit(command ? 0 : 2)
  }

  const fn = COMMANDS[command]
  if (!fn) {
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exit(2)
  }

  const logger = buildLogger(flags)
  try {
    await fn({ logger, positional, flags })
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(`API error (${err.status} ${err.code}): ${err.message}`)
      if (err.details !== undefined) {
        console.error(`Details: ${JSON.stringify(err.details)}`)
      }
      process.exit(1)
    }
    if (err instanceof Error && err.name === 'NotAuthenticatedError') {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
