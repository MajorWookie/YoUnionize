/**
 * Design tokens — single source of truth for color usage outside of the
 * Mantine palette definitions in `src/theme.ts`.
 *
 * Two consumer shapes are exported because Mantine's color system has two
 * legitimate forms depending on where the value is used:
 *
 *   1. Mantine prop form: `'navy.6'` — for `c=`, `bg=`, `color=` props on
 *      Mantine components, and anywhere Mantine itself parses the string.
 *
 *   2. CSS variable form: `var(--mantine-color-navy-6)` — for raw SVG
 *      `fill`/`stroke` attributes, inline `style={{ color: ... }}`, or any
 *      DOM context that needs a real CSS color value (recharts, custom SVG,
 *      Konva, etc).
 *
 * Helpers below convert between forms when needed.
 */

/** Convert a Mantine token string (`'navy.6'`) into a CSS variable reference. */
export function tokenVar(token: string): string {
  return `var(--mantine-color-${token.replace('.', '-')})`
}

// ── Semantic color aliases (Mantine prop form) ─────────────────────────

export const semanticColors = {
  success: 'green.6',
  warning: 'amber.6',
  danger: 'red.6',
  info: 'navy.6',
  successBg: 'green.0',
  warningBg: 'amber.0',
  dangerBg: 'red.0',
  infoBg: 'navy.0',
} as const

// ── Chart palette (Mantine prop form) ──────────────────────────────────
// 10 distinct colors at consistent shade-6 saturation. Use `chartPalette[i]`
// in any chart component that needs a stable categorical color sequence.

export const chartPalette = [
  'navy.6',
  'terracotta.6',
  'green.6',
  'amber.6',
  'red.6',
  'grape.6',
  'teal.6',
  'pink.6',
  'cyan.6',
  'lime.6',
] as const

// ── Income statement ramps (CSS variable form) ─────────────────────────
// Used by `src/lib/income-data-extractor.ts` to color sunburst slices.
// Sequential ramps progress from light → dark within a single hue.

/** Revenue sub-segments — sequential blue ramp (light → dark). */
export const revenueRamp = [
  tokenVar('navy.3'),
  tokenVar('navy.5'),
  tokenVar('navy.6'),
  tokenVar('navy.7'),
  tokenVar('navy.8'),
] as const

/** Operating expense sub-items — sequential warm ramp (terracotta + amber). */
export const opexRamp = [
  tokenVar('terracotta.4'),
  tokenVar('terracotta.5'),
  tokenVar('terracotta.6'),
  tokenVar('terracotta.7'),
  tokenVar('amber.6'),
  tokenVar('amber.7'),
] as const

/** Single-purpose colors used in the income waterfall ring. */
export const incomeWaterfall = {
  opex: tokenVar('terracotta.6'),
  operatingIncome: tokenVar('slate.5'),
  interestExpense: tokenVar('red.5'),
  nonOpPositive: tokenVar('green.5'),
  nonOpNegative: tokenVar('red.5'),
  tax: tokenVar('grape.5'),
  netIncome: tokenVar('green.6'),
  netLoss: tokenVar('red.6'),
} as const
