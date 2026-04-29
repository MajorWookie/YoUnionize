/**
 * YoUnionize color palette — trustworthy, financial, clean.
 *
 * Navy  = primary brand
 * Green = positive / gains
 * Red   = negative / losses
 * Slate = neutral UI surfaces
 */

const palette = {
  // Navy
  navy1: '#14161E',
  navy2: '#071024',
  navy3: '#152a4f',
  navy4: '#1b3561',
  navy5: '#214073',
  navy6: '#274b85',
  navy7: '#2d5697',
  navy8: '#3361a9',
  navy9: '#3a6cbb',
  navy10: '#5a8cd4',
  navy11: '#7aa5e0',
  navy12: '#b8d0f0',

  // Slate (neutral)
  slate1: '#f8f9fa',
  slate2: '#f1f3f5',
  slate3: '#e9ecef',
  slate4: '#dee2e6',
  slate5: '#ced4da',
  slate6: '#adb5bd',
  slate7: '#868e96',
  slate8: '#495057',
  slate9: '#343a40',
  slate10: '#212529',
  slate11: '#16191d',
  slate12: '#0d0f12',

  // Green (positive)
  green1: '#e6f9ed',
  green2: '#b3edca',
  green3: '#80e1a7',
  green4: '#4dd584',
  green5: '#1ac961',
  green6: '#15a34f',
  green7: '#107d3d',
  green8: '#0b572b',
  green9: '#069639',
  green10: '#05803b',
  green11: '#046b30',
  green12: '#034d22',

  // Red (negative)
  red1: '#fef2f2',
  red2: '#fde8e8',
  red3: '#fca5a5',
  red4: '#f87171',
  red5: '#ef4444',
  red6: '#dc2626',
  red7: '#b91c1c',
  red8: '#991b1b',
  red9: '#e53e3e',
  red10: '#c53030',
  red11: '#9b2c2c',
  red12: '#742a2a',
}

// ─── Light theme ──────────────────────────────────────────────────────────────

const lightColors = {
  background: '#ffffff',
  backgroundHover: palette.slate1,
  backgroundPress: palette.slate2,
  backgroundFocus: palette.slate2,
  backgroundStrong: palette.slate1,
  backgroundTransparent: 'rgba(255, 255, 255, 0)',

  color: palette.slate10,
  colorHover: palette.slate11,
  colorPress: palette.slate9,
  colorFocus: palette.slate10,
  colorTransparent: 'rgba(0, 0, 0, 0)',

  borderColor: palette.slate3,
  borderColorHover: palette.slate4,
  borderColorFocus: palette.navy9,
  borderColorPress: palette.slate5,

  placeholderColor: palette.slate6,
  outlineColor: 'rgba(58, 108, 187, 0.4)',

  // Semantic surface tokens
  color1: '#ffffff',
  color2: palette.slate1,
  color3: palette.slate2,
  color4: palette.slate3,
  color5: palette.slate4,
  color6: palette.slate5,
  color7: palette.slate6,
  color8: palette.slate7,
  color9: palette.navy9,
  color10: palette.navy8,
  color11: palette.slate9,
  color12: palette.slate10,

  shadowColor: 'rgba(0, 0, 0, 0.08)',
  shadowColorHover: 'rgba(0, 0, 0, 0.12)',
  shadowColorPress: 'rgba(0, 0, 0, 0.06)',
  shadowColorFocus: 'rgba(0, 0, 0, 0.08)',
}

// ─── Dark theme ──────────────────────────────────────────────────────────────

const darkColors = {
  background: palette.navy1,
  backgroundHover: palette.navy2,
  backgroundPress: palette.navy3,
  backgroundFocus: palette.navy2,
  backgroundStrong: palette.slate12,
  backgroundTransparent: 'rgba(10, 22, 40, 0)',

  color: palette.slate1,
  colorHover: '#ffffff',
  colorPress: palette.slate2,
  colorFocus: palette.slate1,
  colorTransparent: 'rgba(255, 255, 255, 0)',

  borderColor: palette.navy4,
  borderColorHover: palette.navy5,
  borderColorFocus: palette.navy9,
  borderColorPress: palette.navy6,

  placeholderColor: palette.slate6,
  outlineColor: 'rgba(58, 108, 187, 0.5)',

  color1: palette.navy1,
  color2: palette.slate10,
  color3: palette.navy2,
  color4: palette.navy4,
  color5: palette.navy5,
  color6: palette.navy6,
  color7: palette.navy7,
  color8: palette.slate6,
  color9: palette.navy9,
  color10: palette.navy10,
  color11: palette.slate2,
  color12: '#ffffff',

  shadowColor: 'rgba(0, 0, 0, 0.25)',
  shadowColorHover: 'rgba(0, 0, 0, 0.35)',
  shadowColorPress: 'rgba(0, 0, 0, 0.2)',
  shadowColorFocus: 'rgba(0, 0, 0, 0.25)',
}

// ─── Accent sub-themes ────────────────────────────────────────────────────────

const accentLight = {
  background: palette.navy9,
  backgroundHover: palette.navy8,
  backgroundPress: palette.navy7,
  backgroundFocus: palette.navy8,
  color: '#ffffff',
  colorHover: '#ffffff',
  colorPress: palette.slate2,
  borderColor: palette.navy7,
  borderColorHover: palette.navy6,
}

const accentDark = {
  background: palette.navy9,
  backgroundHover: palette.navy10,
  backgroundPress: palette.navy11,
  backgroundFocus: palette.navy10,
  color: '#ffffff',
  colorHover: '#ffffff',
  colorPress: palette.slate2,
  borderColor: palette.navy7,
  borderColorHover: palette.navy8,
}

const greenLight = {
  background: palette.green6,
  backgroundHover: palette.green7,
  backgroundPress: palette.green8,
  color: '#ffffff',
  color9: palette.green6,
  color10: palette.green7,
  color11: palette.green8,
}

const greenDark = {
  background: palette.green9,
  backgroundHover: palette.green10,
  backgroundPress: palette.green11,
  color: '#ffffff',
  color9: palette.green9,
  color10: palette.green10,
  color11: palette.green11,
}

const redLight = {
  background: palette.red6,
  backgroundHover: palette.red7,
  backgroundPress: palette.red8,
  color: '#ffffff',
  color9: palette.red6,
  color10: palette.red7,
  color11: palette.red8,
}

const redDark = {
  background: palette.red9,
  backgroundHover: palette.red10,
  backgroundPress: palette.red11,
  color: '#ffffff',
  color9: palette.red9,
  color10: palette.red10,
  color11: palette.red11,
}

// ─── Export ────────────────────────────────────────────────────────────────────

export const themes = {
  light: lightColors,
  dark: darkColors,
  light_accent: accentLight,
  dark_accent: accentDark,
  light_green: greenLight,
  dark_green: greenDark,
  light_red: redLight,
  dark_red: redDark,
} as const

export { palette }
