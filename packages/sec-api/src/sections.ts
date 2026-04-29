import {
  Def14aSection,
  EightKSection,
  TenKSection,
  TenQSection,
  type SectionItem,
} from './sec-api.constants'

export interface SectionItemInfo {
  code: SectionItem
  name: string
}

const TEN_K_ITEMS: ReadonlyArray<SectionItemInfo> = Object.entries(TenKSection).map(
  ([name, code]) => ({ code, name }),
)
const TEN_Q_ITEMS: ReadonlyArray<SectionItemInfo> = Object.entries(TenQSection).map(
  ([name, code]) => ({ code, name }),
)
const EIGHT_K_ITEMS: ReadonlyArray<SectionItemInfo> = Object.entries(EightKSection).map(
  ([name, code]) => ({ code, name }),
)
const DEF_14A_ITEMS: ReadonlyArray<SectionItemInfo> = Object.entries(Def14aSection).map(
  ([name, code]) => ({ code, name }),
)

export function getSectionItemsForFilingType(filingType: string): ReadonlyArray<SectionItemInfo> {
  switch (filingType) {
    case '10-K':
      return TEN_K_ITEMS
    case '10-Q':
      return TEN_Q_ITEMS
    case '8-K':
      return EIGHT_K_ITEMS
    case 'DEF 14A':
      return DEF_14A_ITEMS
    default:
      return []
  }
}

/**
 * Filter 8-K section items down to the ones actually present in this filing.
 *
 * Critical for performance — sec-api.io's async section extractor will return
 * the literal string `"processing"` for any item we ask about, regardless of
 * whether it exists in the filing. For items that *don't* exist, the
 * extraction never completes and our polling budget is wasted (60-90s of
 * dead time per absent item, per filing).
 *
 * sec-api's filing search response includes `items` as an array of strings
 * like "Item 5.02: Departure of Directors…". This helper parses those to the
 * SEC code format ("5-2", "7-1", etc.) and intersects with our enum.
 *
 * `signature` is always included — every 8-K has a signature block.
 *
 * For 10-K, 10-Q, DEF 14A: the form's items are predictable from the form
 * type itself (every 10-K has all 21 items as section headings, even when
 * empty), so this filter is a no-op for those types.
 */
export function getActualSectionItems(
  filingType: string,
  rawItems: ReadonlyArray<string> | undefined,
): ReadonlyArray<SectionItemInfo> {
  const all = getSectionItemsForFilingType(filingType)
  if (filingType !== '8-K' || !rawItems || rawItems.length === 0) {
    return all
  }

  const presentCodes = new Set<string>()
  for (const itemString of rawItems) {
    // Match "Item 5.02", "Item 1.01", etc. — major.minor with optional
    // leading zeros on the minor (sec-api strings use "5.02" but our enum
    // uses "5-2", so we normalise by parseInt-ing the minor).
    const match = itemString.match(/Item\s+(\d+)\.(\d+)/i)
    if (!match) continue
    const major = match[1]
    const minor = String(Number.parseInt(match[2], 10))
    presentCodes.add(`${major}-${minor}`)
  }
  presentCodes.add('signature')

  return all.filter((info) => presentCodes.has(info.code))
}

interface LegacyMapping {
  code: SectionItem
  filingType: string
}

const LEGACY_KEY_TO_CODE: Record<string, ReadonlyArray<LegacyMapping>> = {
  businessOverview: [{ code: TenKSection.BUSINESS_OVERVIEW, filingType: '10-K' }],
  riskFactors: [
    { code: TenKSection.RISK_FACTORS, filingType: '10-K' },
    { code: TenQSection.RISK_FACTORS, filingType: '10-Q' },
  ],
  mdAndA: [
    { code: TenKSection.MD_AND_A, filingType: '10-K' },
    { code: TenQSection.MD_AND_A, filingType: '10-Q' },
  ],
  legalProceedings: [
    { code: TenKSection.LEGAL_PROCEEDINGS, filingType: '10-K' },
    { code: TenQSection.LEGAL_PROCEEDINGS, filingType: '10-Q' },
  ],
  executiveCompensation: [
    { code: TenKSection.EXECUTIVE_COMPENSATION, filingType: '10-K' },
    { code: Def14aSection.EXECUTIVE_COMPENSATION, filingType: 'DEF 14A' },
  ],
  proxy: [{ code: Def14aSection.PROXY, filingType: 'DEF 14A' }],
  financialStatements: [
    { code: TenKSection.FINANCIAL_STATEMENTS, filingType: '10-K' },
    { code: TenQSection.FINANCIAL_STATEMENTS, filingType: '10-Q' },
  ],
}

/**
 * Translate a legacy camelCase section key (as used in
 * `filing_summaries.raw_data.extractedSections`) to its SEC section code,
 * resolved against the filing type.
 */
export function legacyKeyToSectionCode(
  key: string,
  filingType: string,
): SectionItem | null {
  const candidates = LEGACY_KEY_TO_CODE[key]
  if (!candidates) return null
  const match = candidates.find((c) => c.filingType === filingType)
  return match?.code ?? null
}

const CODE_TO_LEGACY_KEY: Record<string, Record<string, string>> = {
  '10-K': {
    [TenKSection.BUSINESS_OVERVIEW]: 'businessOverview',
    [TenKSection.RISK_FACTORS]: 'riskFactors',
    [TenKSection.MD_AND_A]: 'mdAndA',
    [TenKSection.LEGAL_PROCEEDINGS]: 'legalProceedings',
    [TenKSection.EXECUTIVE_COMPENSATION]: 'executiveCompensation',
    [TenKSection.FINANCIAL_STATEMENTS]: 'financialStatements',
  },
  '10-Q': {
    [TenQSection.MD_AND_A]: 'mdAndA',
    [TenQSection.RISK_FACTORS]: 'riskFactors',
    [TenQSection.LEGAL_PROCEEDINGS]: 'legalProceedings',
    [TenQSection.FINANCIAL_STATEMENTS]: 'financialStatements',
  },
  'DEF 14A': {
    [Def14aSection.PROXY]: 'proxy',
    [Def14aSection.EXECUTIVE_COMPENSATION]: 'executiveCompensation',
  },
}

/**
 * Inverse of `legacyKeyToSectionCode`: maps a SEC section code back to the
 * legacy camelCase key for a given filing type. Returns null when no legacy
 * key was ever defined for that code (most 10-K items, all 8-K items).
 */
export function sectionCodeToLegacyKey(
  code: string,
  filingType: string,
): string | null {
  return CODE_TO_LEGACY_KEY[filingType]?.[code] ?? null
}

const ENUM_NAME_BY_FILING_TYPE: Record<string, Record<string, string>> = {
  '10-K': Object.fromEntries(Object.entries(TenKSection).map(([k, v]) => [v, k])),
  '10-Q': Object.fromEntries(Object.entries(TenQSection).map(([k, v]) => [v, k])),
  '8-K': Object.fromEntries(Object.entries(EightKSection).map(([k, v]) => [v, k])),
  'DEF 14A': Object.fromEntries(Object.entries(Def14aSection).map(([k, v]) => [v, k])),
}

/**
 * Returns a human-friendly name for a section code (e.g. '7' → 'MD_AND_A').
 * Falls back to the raw code if unknown.
 */
export function getSectionFriendlyName(code: string, filingType: string): string {
  return ENUM_NAME_BY_FILING_TYPE[filingType]?.[code] ?? code
}
