import {
  Anchor,
  Badge,
  Button,
  Card,
  createTheme,
  Loader,
  type MantineColorsTuple,
  Notification,
  NumberInput,
  Paper,
  Select,
  TextInput,
} from '@mantine/core'

// ── Color palettes ────────────────────────────────────────────────────
//
// Civic-trust direction (NerdWallet / Vox data desk vibe). All tuples are
// monotonically increasing in darkness from index 0 → 9. Index 6 is the
// default Mantine primary shade in light mode; index 4 is the dark-mode
// primary shade (`primaryShade` below).

/** Primary brand blue. Recolored warmer + lighter than the original Tamagui
 *  port (#274b85 at shade 6 → #3b6cb8) to read as "civic" rather than
 *  "Department of Treasury". */
const navy: MantineColorsTuple = [
  '#eef3fb',
  '#d6e3f4',
  '#b3c8e6',
  '#8aa8d4',
  '#6890c5',
  '#4f7dbb',
  '#3b6cb8',
  '#2e5a9e',
  '#244a85',
  '#1c3a6c',
]

/** Warm accent. Used for eyebrows, callouts, blockquote rules, hero accents.
 *  Not a chart-data color — chart palette uses other entries. */
const terracotta: MantineColorsTuple = [
  '#fbeee7',
  '#f5d6c5',
  '#ecb89c',
  '#e09b73',
  '#d68354',
  '#cc6f3e',
  '#c25e2c',
  '#a64d23',
  '#883e1c',
  '#6b3017',
]

/** Neutral grayscale. Inherited from the prior theme (already correct). */
const slate: MantineColorsTuple = [
  '#f8f9fa',
  '#f1f3f5',
  '#e9ecef',
  '#dee2e6',
  '#ced4da',
  '#adb5bd',
  '#868e96',
  '#495057',
  '#343a40',
  '#212529',
]

/** Success / positive. Replaces the prior tuple which had non-monotonic
 *  index 7 vs 8 (#0b572b darker than #069639) — Mantine's variant system
 *  assumes shades are monotonically darker. */
const green: MantineColorsTuple = [
  '#ecfdf5',
  '#d1fae5',
  '#a7f3d0',
  '#6ee7b7',
  '#34d399',
  '#10b981',
  '#059669',
  '#047857',
  '#065f46',
  '#064e3b',
]

/** Danger / negative. Same monotonicity fix as green. */
const red: MantineColorsTuple = [
  '#fff1f2',
  '#ffe4e6',
  '#fecdd3',
  '#fda4af',
  '#fb7185',
  '#f43f5e',
  '#e11d48',
  '#be123c',
  '#9f1239',
  '#881337',
]

/** Warning. Distinct from red so "danger" can stay strictly destructive. */
const amber: MantineColorsTuple = [
  '#fffbeb',
  '#fef3c7',
  '#fde68a',
  '#fcd34d',
  '#fbbf24',
  '#f59e0b',
  '#d97706',
  '#b45309',
  '#92400e',
  '#78350f',
]

// ── Theme ──────────────────────────────────────────────────────────────

export const theme = createTheme({
  primaryColor: 'navy',
  // Lift the primary shade in dark mode so text-on-primary stays legible.
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'md',
  focusRing: 'auto',
  fontFamily:
    '"Inter Variable", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  colors: { navy, terracotta, slate, green, red, amber },
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
  },
  lineHeights: {
    xs: '1.4',
    sm: '1.45',
    md: '1.55',
    lg: '1.55',
    xl: '1.5',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  headings: {
    fontFamily:
      '"Inter Variable", Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '36px', lineHeight: '1.15', fontWeight: '700' },
      h2: { fontSize: '28px', lineHeight: '1.2', fontWeight: '700' },
      h3: { fontSize: '22px', lineHeight: '1.3', fontWeight: '600' },
      h4: { fontSize: '18px', lineHeight: '1.4', fontWeight: '600' },
      h5: { fontSize: '15px', lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: '13px', lineHeight: '1.4', fontWeight: '600' },
    },
  },
  components: {
    Button: Button.extend({
      defaultProps: { radius: 'md', size: 'sm' },
      styles: { root: { fontWeight: 600 } },
    }),
    Card: Card.extend({
      defaultProps: {
        radius: 'md',
        withBorder: true,
        shadow: 'none',
        padding: 'lg',
      },
    }),
    Paper: Paper.extend({
      defaultProps: { radius: 'md', shadow: 'none' },
    }),
    Badge: Badge.extend({
      defaultProps: { radius: 'sm', size: 'sm', variant: 'light' },
    }),
    TextInput: TextInput.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    Select: Select.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    NumberInput: NumberInput.extend({
      defaultProps: { radius: 'md', size: 'sm' },
    }),
    Notification: Notification.extend({
      defaultProps: { radius: 'md', withBorder: true },
    }),
    Anchor: Anchor.extend({
      defaultProps: { underline: 'hover' },
    }),
    Loader: Loader.extend({
      defaultProps: { type: 'dots' },
    }),
  },
})
