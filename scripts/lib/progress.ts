/**
 * Heartbeat progress reporter for long-running CLI scripts.
 *
 * Each in-flight unit of work (e.g. a ticker) registers its current phase via
 * `startPhase` / `endPhase`. A background timer prints a single status line
 * every `intervalMs` showing what every unit is currently doing and how long
 * it has been in that phase. Designed to coexist with normal `console.info`
 * output rather than fight it with cursor manipulation, so it works equally
 * well in a TTY, in a piped log, or in CI.
 */

interface PhaseEntry {
  phase: string
  startedAt: number
}

const inflight = new Map<string, PhaseEntry>()

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
let spinnerIndex = 0

let timer: ReturnType<typeof setInterval> | null = null
let overallStart = 0
let label = '[Progress]'

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m${s % 60}s`
}

export function startPhase(unit: string, phase: string): void {
  inflight.set(unit, { phase, startedAt: Date.now() })
}

export function endPhase(unit: string): void {
  inflight.delete(unit)
}

export function startHeartbeat(opts: { label?: string; intervalMs?: number } = {}): void {
  if (timer) return
  label = opts.label ?? '[Progress]'
  overallStart = Date.now()
  const intervalMs = opts.intervalMs ?? 5000
  timer = setInterval(tick, intervalMs)
  // Don't keep the event loop alive on our account.
  if (typeof timer === 'object' && timer && 'unref' in timer) {
    (timer as { unref: () => void }).unref()
  }
}

export function stopHeartbeat(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  inflight.clear()
}

function tick(): void {
  if (inflight.size === 0) return
  const spin = SPINNER_FRAMES[spinnerIndex++ % SPINNER_FRAMES.length]
  const elapsed = formatDuration(Date.now() - overallStart)
  const parts: Array<string> = []
  for (const [unit, { phase, startedAt }] of inflight) {
    parts.push(`${unit}: ${phase} (${formatDuration(Date.now() - startedAt)})`)
  }
  console.info(`${label} ${spin} working ${elapsed} elapsed | ${parts.join(' · ')}`)
}
