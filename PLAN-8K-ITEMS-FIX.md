# Plan: SEC Schema & Pipeline Data Integrity Fixes

> Created: 2026-03-19
> Status: **Draft — not yet implemented**

## Problem Summary

A full audit of the SEC data pipeline uncovered multiple data integrity issues across Valibot schemas, XBRL storage, and section extraction. The root cause in most cases is Valibot's `v.object()` **silently stripping** undeclared keys.

### Issues Identified

1. **`items[]` stripped from filing search responses** — `FilingSchema` doesn't declare `items`, so Valibot drops the array of item labels (e.g., `["Item 2.02: Results of Operations...", "Item 9.01: Financial Statements..."]`) before it reaches storage
2. **Section extraction is blind** — all 20 8-K section codes are tried per filing instead of targeting only the items listed in `items[]`
3. **`FilingEntitySchema` has required fields that can be absent** — `companyName` and `cik` are required, but co-registrant entities sometimes omit them, causing `v.parse()` to throw for the entire filing search response
4. **`Form8KFilingSchema.items` only captures 3 item types** — `item401`, `item402`, `item502` are declared; all other structured item types from the API are silently dropped
5. **XBRL blob duplicated into domain table** — the entire XBRL-to-JSON response (2–10 MB per filing, including HTML text blocks) is stored in both `raw_sec_responses` AND `filing_summaries.rawData.xbrlData`
6. **Cybersecurity/CoverPage fields invisible to transformer** — `xbrl-transformer.ts` only extracts 4 financial statement sections; top-level string fields (Cybersecurity disclosures) and scalar metadata (CoverPage) are stored but never surfaced to summarization or display

## Affected Files

| File | Role | Issues |
|------|------|--------|
| `packages/sec-api/src/sec-api.schemas.ts` | Valibot schemas for all SEC API responses | #1 `items[]` stripped, #3 required entity fields, #4 limited 8-K item types |
| `packages/sec-api/src/sec-api.types.ts` | TypeScript interfaces | #1 missing `items` on `Filing`, #3 `FilingEntity` fields |
| `packages/sec-api/src/sec-api.constants.ts` | Section code enums | #2 needs item-code mapping utility |
| `src/server/services/sec-fetcher.ts` | Phase 1 fetcher | #2 blind section extraction |
| `src/server/services/raw-data-processor.ts` | Phase 2 processor | #5 copies full XBRL blob into domain table |
| `src/server/services/xbrl-transformer.ts` | XBRL → financial statements | #6 ignores top-level string/scalar XBRL fields |
| `src/server/services/summarization-pipeline.ts` | AI summarization | #2 could include item labels in context |

## Changes

### Step 1: Add `items` to `FilingSchema` and `Filing` type

**`packages/sec-api/src/sec-api.schemas.ts`** — Add to `FilingSchema`:
```typescript
items: v.optional(v.array(v.string())),
```

**`packages/sec-api/src/sec-api.types.ts`** — Add to `Filing` interface:
```typescript
items?: Array<string>
```

> This is the critical one-line fix. Once added, `items[]` flows through validation and gets stored in both `raw_sec_responses` and `filingSummaries.rawData`.

### Step 2: Add item-code mapping utility

**`packages/sec-api/src/sec-api.constants.ts`** — Add a mapping function:

```typescript
/**
 * Map human-readable 8-K item strings to section extraction codes.
 *
 * Input:  "Item 2.02: Results of Operations and Financial Condition"
 * Output: "2-2"
 *
 * Input:  "Item 5.07: Submission of Matters to a Vote of Security Holders"
 * Output: "5-7"
 */
export function itemLabelToSectionCode(label: string): string | null {
  const match = label.match(/Item\s+(\d+)\.(\d+)/)
  if (!match) return null
  return `${match[1]}-${parseInt(match[2], 10)}`
}
```

Validate that the returned code is a member of `EightKSection` before using it, to avoid requesting invalid codes from the extractor API.

### Step 3: Target section extraction for 8-K filings

**`src/server/services/sec-fetcher.ts`** — Replace the blind extraction block (lines 141-163) with targeted extraction:

```
Before:
  For every 8-K filing → try all 17 EightKSection codes

After:
  For every 8-K filing:
    1. Read filing.items[] (the string array)
    2. Map each to a section code via itemLabelToSectionCode()
    3. Always include '9-1' (Financial Exhibits) as it's almost always present
    4. Only extract those specific sections
    5. Fall back to all 17 codes if items[] is missing (backward compat)
```

Expected improvement: **~2-4 API calls per filing instead of 17.** For AAPL's 10 8-K filings from the past year, that's ~30 calls instead of ~170.

### Step 4: Enrich `buildEightKContext()` with item labels

**`src/server/services/summarization-pipeline.ts`** — In `buildEightKContext()`, add the items list to Claude's prompt context:

```typescript
const items = rawData.items as Array<string> | undefined
if (items && items.length > 0) {
  parts.push(`Filing items:\n${items.map((i) => `- ${i}`).join('\n')}`)
}
```

This gives Claude structured knowledge of what the 8-K covers (e.g., "this is an earnings release" vs "this is a director resignation") without relying on the less-structured `description` field.

### Step 5: Harden `FilingEntitySchema` (Issue #3)

**`packages/sec-api/src/sec-api.schemas.ts`** — Make required fields optional and add missing fields:

```typescript
export const FilingEntitySchema = v.object({
  companyName: v.optional(v.pipe(v.string(), v.minLength(0))),  // was required — absent on some co-registrants
  cik: v.optional(v.string()),                                    // was required — same issue
  ticker: v.optional(v.string()),
  irsNo: v.optional(v.string()),
  stateOfIncorporation: v.optional(v.string()),
  fiscalYearEnd: v.optional(v.string()),
  type: v.optional(v.string()),
  act: v.optional(v.string()),       // e.g., "34" (Exchange Act)
  fileNo: v.optional(v.string()),    // e.g., "001-36743"
  sic: v.optional(v.string()),       // e.g., "3571 Electronic Computers"
})
```

**`packages/sec-api/src/sec-api.types.ts`** — Update `FilingEntity` interface to match:

```typescript
export interface FilingEntity {
  companyName?: string   // was required
  cik?: string           // was required
  ticker?: string
  irsNo?: string
  stateOfIncorporation?: string
  fiscalYearEnd?: string
  type?: string
  act?: string
  fileNo?: string
  sic?: string
}
```

These are useful for SIC-based industry classification. `irsNo` is already optional and handles the inconsistency where older filings omit it.

**Do NOT capture** the `undefined` field or `filmNo` — the former is a sec-api.io parsing artifact, and the latter has no downstream use.

### Step 6: Expand `Form8KFilingSchema` item types (Issue #4)

**`packages/sec-api/src/sec-api.schemas.ts`** — The current `Form8KFilingSchema.items` only declares 3 item types:

```typescript
// BEFORE — only 3 items, all others silently dropped
items: v.optional(v.object({
  item401: v.optional(Form8KItem401Schema),
  item402: v.optional(Form8KItem402Schema),
  item502: v.optional(Form8KItem502Schema),
})),
```

Switch to `v.looseObject()` so unknown item types are preserved as `unknown` rather than stripped:

```typescript
// AFTER — known items are typed, unknown items preserved as-is
items: v.optional(v.looseObject({
  item401: v.optional(Form8KItem401Schema),
  item402: v.optional(Form8KItem402Schema),
  item502: v.optional(Form8KItem502Schema),
})),
```

Also update `raw-data-processor.ts` `processForm8K()` to iterate all keys in `items` rather than hardcoding 3:

```typescript
// BEFORE — hardcoded 3 item types
const itemTypes = ['item401', 'item402', 'item502'] as const

// AFTER — iterate all keys, map known patterns to item codes
for (const [itemKey, itemData] of Object.entries(items)) {
  if (!itemData) continue
  const itemType = itemKeyToCode(itemKey)  // e.g., 'item202' → '2.02'
  // ... insert into form_8k_events
}
```

### Step 7: Slim down XBRL blob in domain table (Issue #5)

**`src/server/services/raw-data-processor.ts`** — In `processXbrl()`, instead of storing the entire XBRL response in `filing_summaries.rawData.xbrlData`, store only the structured financial data sections:

```typescript
// BEFORE — entire blob (2–10 MB including HTML text blocks)
existingRawData.xbrlData = data

// AFTER — only structured financial sections
const FINANCIAL_KEYS = [
  'StatementsOfIncome', 'BalanceSheets', 'StatementsOfCashFlows',
  'StatementsOfShareholdersEquity', 'CoverPage', 'AuditorInformation',
]
const slim: Record<string, unknown> = {}
for (const key of Object.keys(data)) {
  // Keep dict-of-lists sections (financial data) and known metadata
  const val = data[key]
  if (FINANCIAL_KEYS.some(fk => key.toLowerCase().includes(fk.toLowerCase()))) {
    slim[key] = val
  } else if (val && typeof val === 'object' && !isHtmlTextBlock(val)) {
    slim[key] = val  // keep structured data, skip HTML blobs
  }
}
existingRawData.xbrlData = slim
```

The full verbatim response remains in `raw_sec_responses` for future reprocessing. This reduces `filing_summaries.rawData` from ~2–10 MB to ~200–500 KB per filing.

### Step 8: Surface Cybersecurity & CoverPage from XBRL (Issue #6)

**`src/server/services/xbrl-transformer.ts`** — Add a new export function to extract top-level metadata and text fields that don't fit the financial statement structure:

```typescript
export interface XbrlMetadata {
  coverPage: Record<string, string> | null
  cybersecurity: Record<string, string> | null
  auditorInfo: Record<string, unknown> | null
}

export function extractXbrlMetadata(xbrlData: Record<string, unknown>): XbrlMetadata {
  const result: XbrlMetadata = { coverPage: null, cybersecurity: null, auditorInfo: null }

  if (xbrlData.CoverPage && typeof xbrlData.CoverPage === 'object') {
    result.coverPage = xbrlData.CoverPage as Record<string, string>
  }

  // Collect top-level Cybersecurity fields (string values at root)
  const cyberFields: Record<string, string> = {}
  for (const [key, val] of Object.entries(xbrlData)) {
    if (key.startsWith('Cybersecurity') && typeof val === 'string') {
      cyberFields[key] = val
    }
  }
  if (Object.keys(cyberFields).length > 0) result.cybersecurity = cyberFields

  if (xbrlData.AuditorInformation && typeof xbrlData.AuditorInformation === 'object') {
    result.auditorInfo = xbrlData.AuditorInformation as Record<string, unknown>
  }

  return result
}
```

This can be called from the summarization pipeline to include CoverPage and Cybersecurity context when generating AI summaries. **Wire-up to summarization pipeline is optional** — the extraction function itself is the deliverable for this step.

## Testing

### Steps 1–4 (items[] fix + section optimization)
- [ ] Unit test: `itemLabelToSectionCode()` maps known item strings correctly
- [ ] Unit test: handles malformed/missing item labels gracefully (returns null)
- [ ] Integration: Run Phase 1 fetch for a known company and verify `items[]` appears in `raw_sec_responses.rawResponse.filings[].items`
- [ ] Integration: Verify `filingSummaries.rawData.items` is populated after Phase 2
- [ ] Integration: Verify section extraction only targets the items listed (check log output for number of section calls)
- [ ] Verify backward compatibility: filings already in the DB without `items[]` in rawData don't break the summarization pipeline

### Step 5 (entity schema hardening)
- [ ] Unit test: parse a filing response with entities missing `companyName` — should not throw
- [ ] Unit test: parse a filing response with entities missing `cik` — should not throw
- [ ] Verify `act`, `fileNo`, `sic` fields are preserved when present

### Step 6 (Form 8-K expanded items)
- [ ] Unit test: verify `v.looseObject()` preserves unknown item keys (e.g., `item202`) in parsed output
- [ ] Integration: fetch a real 8-K with non-401/402/502 items and verify they appear in `form_8k_events`
- [ ] Verify `processForm8K()` iterates dynamically rather than using hardcoded item list

### Step 7 (XBRL slim storage)
- [ ] Integration: compare size of `filing_summaries.rawData.xbrlData` before and after the change for an Apple 10-K
- [ ] Verify `xbrl-transformer.ts` still works correctly with the slimmed data (all 4 financial statements extracted)
- [ ] Verify full XBRL blob remains in `raw_sec_responses` unchanged

### Step 8 (Cybersecurity/CoverPage extraction)
- [ ] Unit test: `extractXbrlMetadata()` extracts CoverPage when present
- [ ] Unit test: `extractXbrlMetadata()` collects Cybersecurity string fields from root
- [ ] Unit test: returns nulls gracefully when fields are absent (small-company XBRL)

## Risk Assessment

| Step | Risk | Notes |
|------|------|-------|
| 1–2 | **Low** | Additive schema changes — no existing data or behavior modified |
| 3 | **Medium** | Changes section extraction behavior — fallback to all codes handles missing `items[]` |
| 4 | **Low** | Adds context to Claude prompts — strictly additive |
| 5 | **Low** | Making required fields optional is strictly more permissive — cannot break existing valid responses |
| 6 | **Medium** | `v.looseObject()` changes validation behavior for Form 8-K items — test that typed items (`item401` etc.) still parse correctly |
| 7 | **Medium** | Changing what's stored in `filing_summaries.rawData.xbrlData` could break downstream consumers — verify `xbrl-transformer.ts` only reads keys that are preserved |
| 8 | **Low** | New function, no existing code modified — opt-in usage |

**No migration needed**: existing `raw_sec_responses` rows can be re-fetched to pick up `items[]`; existing `filingSummaries` rows without `items[]` in `rawData` are handled by the fallback path. Step 7 only affects future writes — existing oversized blobs remain until a re-fetch.

## Implementation Order

| Priority | Steps | Rationale |
|----------|-------|-----------|
| **P0 — Do first** | 1, 2, 5 | Schema fixes — unblocks everything else, zero behavioral change |
| **P1 — Do next** | 3, 4, 6 | Behavioral improvements that depend on schema fixes |
| **P2 — Do last** | 7, 8 | Storage optimization and new extraction — independent, lower urgency |

## Notes

- The dedicated `/form-8k` API only covers 3 items (4.01, 4.02, 5.02). Most common 8-K items (2.02 earnings, 5.07 shareholder votes, 8.01 other events) have NO structured API — section extraction is the only way to get their content.
- The `entities[].undefined` field in SEC API responses (e.g., `"06 Technology)"`) is a sec-api.io parsing bug on the SIC code — ignore it.
- `entities[].irsNo` is missing on some older filings (confirmed on May 2025 AAPL filings) — this is a SEC EDGAR-side inconsistency, not a bug in our code.
- Valibot `v.object()` strips unknown keys by default (unlike Zod which passes them through). This is the root cause of issues #1, #3, and #4. When in doubt for SEC API schemas, prefer `v.looseObject()` to avoid silent data loss.
- XBRL duplicate facts (same concept in multiple sections, e.g., Revenue in StatementsOfIncome AND Revenue Details) are stored but not a concern — `xbrl-transformer.ts` uses first-match lookup on specific keys.
