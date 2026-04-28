// CLI-side review logger.
//
// Off by default. Enabled per-run via --verbose; can be filtered to a subset
// of company tickers via --companies AAPL,TSLA. Writes to stdout/stderr only
// (no file persistence — Phase 1 doesn't need it; redirect via shell if you
// want a file).
//
// The logger is dependency-injected so the future UI layer can build a
// different one (e.g., streams to a websocket). The CLI command modules
// receive a ReviewLogger and never reach for a global.

export type LogLevel = 'trace' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export interface ReviewLogger {
  trace(scope: string, msg: string, data?: unknown): void
  info(scope: string, msg: string, data?: unknown): void
  warn(scope: string, msg: string, data?: unknown): void
  error(scope: string, msg: string, data?: unknown): void
  /** Returns a filtered child logger for a specific ticker. */
  forTicker(ticker: string | undefined): ReviewLogger
}

export interface LoggerOptions {
  enabled: boolean
  level: LogLevel
  /** Empty/undefined = all tickers. Otherwise only matching tickers log. */
  companyFilter?: ReadonlySet<string>
  /** Optional ticker context for child loggers. */
  ticker?: string
}

class NoopLogger implements ReviewLogger {
  trace() {}
  info() {}
  warn() {}
  error() {}
  forTicker() {
    return this
  }
}

class StreamLogger implements ReviewLogger {
  constructor(private readonly opts: LoggerOptions) {}

  private shouldLog(level: LogLevel): boolean {
    if (!this.opts.enabled) return false
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.opts.level]) return false
    if (this.opts.companyFilter && this.opts.companyFilter.size > 0) {
      // No ticker context → skip when a filter is active.
      if (!this.opts.ticker) return false
      if (!this.opts.companyFilter.has(this.opts.ticker.toUpperCase())) return false
    }
    return true
  }

  private write(level: LogLevel, scope: string, msg: string, data?: unknown) {
    if (!this.shouldLog(level)) return
    const ts = new Date().toISOString()
    const tickerTag = this.opts.ticker ? ` [${this.opts.ticker}]` : ''
    const prefix = `${ts} ${level.toUpperCase().padEnd(5)} [${scope}]${tickerTag}`
    const dataStr = data === undefined ? '' : ` ${safeStringify(data)}`
    const line = `${prefix} ${msg}${dataStr}`
    if (level === 'warn' || level === 'error') {
      console.error(line)
    } else {
      console.info(line)
    }
  }

  trace(scope: string, msg: string, data?: unknown) {
    this.write('trace', scope, msg, data)
  }
  info(scope: string, msg: string, data?: unknown) {
    this.write('info', scope, msg, data)
  }
  warn(scope: string, msg: string, data?: unknown) {
    this.write('warn', scope, msg, data)
  }
  error(scope: string, msg: string, data?: unknown) {
    this.write('error', scope, msg, data)
  }

  forTicker(ticker: string | undefined): ReviewLogger {
    return new StreamLogger({ ...this.opts, ticker })
  }
}

export function createReviewLogger(opts: LoggerOptions): ReviewLogger {
  if (!opts.enabled) return new NoopLogger()
  return new StreamLogger(opts)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
