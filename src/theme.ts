import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Ported from src/tamagui/themes.ts. Mantine wants 10-tuples (lightest → darkest);
// Tamagui's palette is 12 entries, so we keep entries 1..10 and pick navy as the
// primary brand color (index 6 = Mantine's default primary shade).
const navy: MantineColorsTuple = [
  '#b8d0f0', // navy12 — lightest
  '#7aa5e0', // navy11
  '#5a8cd4', // navy10
  '#3a6cbb', // navy9
  '#3361a9', // navy8
  '#2d5697', // navy7
  '#274b85', // navy6 ← Mantine default primary shade
  '#214073', // navy5
  '#1b3561', // navy4
  '#152a4f', // navy3 — darkest
]

const slate: MantineColorsTuple = [
  '#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6', '#ced4da',
  '#adb5bd', '#868e96', '#495057', '#343a40', '#212529',
]

const green: MantineColorsTuple = [
  '#e6f9ed', '#b3edca', '#80e1a7', '#4dd584', '#1ac961',
  '#15a34f', '#107d3d', '#0b572b', '#069639', '#05803b',
]

const red: MantineColorsTuple = [
  '#fef2f2', '#fde8e8', '#fca5a5', '#f87171', '#ef4444',
  '#dc2626', '#b91c1c', '#991b1b', '#e53e3e', '#c53030',
]

export const theme = createTheme({
  primaryColor: 'navy',
  defaultRadius: 'md',
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  colors: { navy, slate, green, red },
})
