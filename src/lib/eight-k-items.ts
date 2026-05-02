import {
  IconAlertTriangle,
  IconChartBar,
  IconFileDollar,
  IconFileText,
  IconNote,
  IconReportMoney,
  IconScale,
  IconSpeakerphone,
  IconUserMinus,
  IconUserOff,
  type Icon,
} from '@tabler/icons-react'
import type { MantineColor } from '@mantine/core'

export interface EightKItemDisplay {
  /** Short, scannable label for the chip ("Officer Change", "Earnings Release"). */
  label: string
  /** Full chip label, e.g. "Item 5.02 — Officer Change". */
  chipLabel: string
  /** Tabler icon component for the avatar circle. */
  icon: Icon
  /** Mantine theme color (e.g. "navy", "terracotta", "red", "green", "slate"). */
  color: MantineColor
}

/**
 * Convert an EightKSection code ("5-2", "1-1") to the SEC's canonical
 * "Item X.YY" rendering ("Item 5.02", "Item 1.01"). Codes that aren't
 * `<digit>-<digit>` (e.g. "signature") are returned as-is.
 */
function formatItemNumber(code: string): string {
  const match = code.match(/^(\d+)-(\d+)$/)
  if (!match) return code
  const major = match[1]
  const minor = match[2].padStart(2, '0')
  return `Item ${major}.${minor}`
}

const ENTRIES: Record<string, Omit<EightKItemDisplay, 'chipLabel'>> = {
  '1-1': { label: 'New Material Agreement', icon: IconFileDollar, color: 'navy' },
  '1-2': { label: 'Bankruptcy', icon: IconAlertTriangle, color: 'red' },
  '1-3': { label: 'Mine Safety', icon: IconAlertTriangle, color: 'slate' },
  '2-2': { label: 'Earnings Release', icon: IconChartBar, color: 'green' },
  '2-3': { label: 'New Obligation', icon: IconFileDollar, color: 'slate' },
  '2-5': { label: 'Exit / Restructuring', icon: IconUserMinus, color: 'red' },
  '2-6': { label: 'Material Impairment', icon: IconAlertTriangle, color: 'red' },
  '3-1': { label: 'Delisting', icon: IconAlertTriangle, color: 'red' },
  '3-2': { label: 'Unregistered Sale', icon: IconReportMoney, color: 'slate' },
  '3-3': { label: 'Modification of Rights', icon: IconFileText, color: 'slate' },
  '4-1': { label: 'Auditor Change', icon: IconScale, color: 'slate' },
  '4-2': { label: 'Financial Restatement', icon: IconAlertTriangle, color: 'red' },
  '5-2': { label: 'Officer Change', icon: IconUserOff, color: 'terracotta' },
  '5-3': { label: 'Charter Amendment', icon: IconFileText, color: 'slate' },
  '5-5': { label: 'Code of Ethics', icon: IconScale, color: 'slate' },
  '6-1': { label: 'Asset-Backed Securities', icon: IconReportMoney, color: 'slate' },
  '7-1': { label: 'Reg FD Disclosure', icon: IconSpeakerphone, color: 'navy' },
  '8-1': { label: 'Other Event', icon: IconNote, color: 'slate' },
  '9-1': { label: 'Financial Exhibits', icon: IconFileText, color: 'slate' },
}

/**
 * Resolve a per-item display payload (label, chip text, icon, color) for
 * an 8-K section code. Falls back to a generic icon + the raw code when
 * SEC publishes a sub-item we haven't catalogued yet — the feed renders
 * something readable rather than crashing.
 */
export function getEightKItemDisplay(code: string): EightKItemDisplay {
  const itemNumber = formatItemNumber(code)
  const entry = ENTRIES[code]
  if (entry) {
    return { ...entry, chipLabel: `${itemNumber} — ${entry.label}` }
  }
  return {
    label: itemNumber,
    chipLabel: itemNumber,
    icon: IconNote,
    color: 'slate',
  }
}
