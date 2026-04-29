/**
 * Per-item prompt dispatch table.
 *
 * Maps each SEC item code (within a filing type) to:
 *   • promptKind   — which Claude prompt template to invoke
 *   • minLength    — skip threshold; below this we record 'skipped' instead
 *                    of spending a Claude call on boilerplate
 *   • skipIfEmpty  — short-circuit before length check
 *
 * The pipeline ([src/server/services/summarization-pipeline.ts]) iterates
 * every filing_sections row for a filing and looks up the dispatch entry
 * here. If the section_code isn't listed, the row falls back to the
 * 'narrative' kind. Adding a new specialised prompt only requires editing
 * this table plus packages/ai/src/prompts/<new>.ts.
 */

import { Def14aSection, EightKSection, TenKSection, TenQSection } from './sec-api.constants'

// ─── Prompt kinds ─────────────────────────────────────────────────────────

/**
 * Each kind corresponds to either a `ClaudeClient` method or the structured
 * XBRL transformer (kinds with the 'xbrl_' prefix produce data with no
 * Claude call). 'narrative' is the catch-all for items we summarise with a
 * generic section-aware prompt.
 */
export type SectionPromptKind =
  // Cross-section synthesis (live on filing_summaries, not filing_sections)
  | 'rollup_executive_summary'
  | 'rollup_employee_impact'
  // Structured (XBRL → typed payload)
  | 'xbrl_income_statement'
  | 'xbrl_balance_sheet'
  | 'xbrl_cash_flow'
  | 'xbrl_shareholders_equity'
  // Specialised narrative prompts
  | 'mda'
  | 'risk_factors'
  | 'business_overview'
  | 'legal_proceedings'
  | 'executive_compensation'
  | 'financial_footnotes'
  | 'cybersecurity'
  | 'controls_and_procedures'
  | 'related_transactions'
  | 'proxy'
  | 'event_8k'
  // Generic narrative — section-aware framing, used for the long-tail items
  | 'narrative'
  // Pass-through — store raw text only, no AI summary
  | 'pass_through'

export interface SectionPromptDispatch {
  promptKind: SectionPromptKind
  /** Below this character count of raw text, skip the Claude call. */
  minLength: number
  /** If true, skip the moment fetch_status != 'success' or text is empty. */
  skipIfEmpty: boolean
}

// Default for any code not explicitly listed (e.g. SEC adds a new sub-item).
const DEFAULT_DISPATCH: SectionPromptDispatch = {
  promptKind: 'narrative',
  minLength: 200,
  skipIfEmpty: true,
}

// Constants shared across the table to keep things readable.
const SHORT: Pick<SectionPromptDispatch, 'minLength' | 'skipIfEmpty'> = {
  minLength: 200,
  skipIfEmpty: true,
}
const LONG: Pick<SectionPromptDispatch, 'minLength' | 'skipIfEmpty'> = {
  minLength: 500,
  skipIfEmpty: true,
}
const PASS: SectionPromptDispatch = {
  promptKind: 'pass_through',
  minLength: 0,
  skipIfEmpty: true,
}

// ─── 10-K dispatch ────────────────────────────────────────────────────────

const TEN_K_DISPATCH: Record<string, SectionPromptDispatch> = {
  [TenKSection.BUSINESS_OVERVIEW]: { promptKind: 'business_overview', ...LONG },
  [TenKSection.RISK_FACTORS]: { promptKind: 'risk_factors', ...LONG },
  [TenKSection.UNRESOLVED_STAFF_COMMENTS]: PASS, // typically empty
  [TenKSection.CYBERSECURITY]: { promptKind: 'cybersecurity', ...SHORT },
  [TenKSection.PROPERTIES]: { promptKind: 'narrative', ...SHORT },
  [TenKSection.LEGAL_PROCEEDINGS]: { promptKind: 'legal_proceedings', ...SHORT },
  [TenKSection.MINE_SAFETY]: PASS, // only relevant to mining issuers
  [TenKSection.MARKET_INFO]: { promptKind: 'narrative', ...SHORT },
  [TenKSection.SELECTED_FINANCIAL]: PASS, // SEC deprecated this in 2021
  [TenKSection.MD_AND_A]: { promptKind: 'mda', ...LONG },
  [TenKSection.QUANTITATIVE_DISCLOSURES]: { promptKind: 'narrative', ...SHORT },
  [TenKSection.FINANCIAL_STATEMENTS]: { promptKind: 'financial_footnotes', ...LONG },
  [TenKSection.DISAGREEMENTS_WITH_ACCOUNTANTS]: PASS, // rarely populated
  [TenKSection.CONTROLS_AND_PROCEDURES]: { promptKind: 'controls_and_procedures', ...SHORT },
  [TenKSection.OTHER_INFO]: { promptKind: 'narrative', ...SHORT },
  [TenKSection.DIRECTORS_AND_GOVERNANCE]: { promptKind: 'narrative', ...SHORT },
  // Item 11 is almost always "incorporated by reference to the Proxy
  // Statement" — the actual compensation analysis lives on the DEF 14A
  // summary. Skip the Claude call here; DEF_14A_DISPATCH handles it.
  [TenKSection.EXECUTIVE_COMPENSATION]: PASS,
  [TenKSection.SECURITY_OWNERSHIP]: { promptKind: 'narrative', ...SHORT },
  [TenKSection.RELATED_TRANSACTIONS]: { promptKind: 'related_transactions', ...SHORT },
  [TenKSection.ACCOUNTANT_FEES]: { promptKind: 'narrative', ...SHORT },
  [TenKSection.EXHIBITS]: PASS, // index of exhibits, not narrative
}

// ─── 10-Q dispatch ────────────────────────────────────────────────────────

const TEN_Q_DISPATCH: Record<string, SectionPromptDispatch> = {
  [TenQSection.FINANCIAL_STATEMENTS]: { promptKind: 'financial_footnotes', ...LONG },
  [TenQSection.MD_AND_A]: { promptKind: 'mda', ...LONG },
  [TenQSection.QUANTITATIVE_DISCLOSURES]: { promptKind: 'narrative', ...SHORT },
  [TenQSection.CONTROLS_AND_PROCEDURES]: { promptKind: 'controls_and_procedures', ...SHORT },
  [TenQSection.LEGAL_PROCEEDINGS]: { promptKind: 'legal_proceedings', ...SHORT },
  [TenQSection.RISK_FACTORS]: { promptKind: 'risk_factors', ...SHORT },
  [TenQSection.UNREGISTERED_SALES]: { promptKind: 'narrative', ...SHORT },
  [TenQSection.DEFAULTS]: { promptKind: 'narrative', ...SHORT },
  [TenQSection.MINE_SAFETY]: PASS,
  [TenQSection.OTHER_INFO]: { promptKind: 'narrative', ...SHORT },
  [TenQSection.EXHIBITS]: PASS,
}

// ─── 8-K dispatch ─────────────────────────────────────────────────────────
// All 8-K items currently route to a single 'event_8k' prompt that builds
// a multi-item context. Per-item specialised prompts can be introduced
// later without changing the pipeline (just edit this table).

const EIGHT_K_DEFAULT: SectionPromptDispatch = {
  promptKind: 'event_8k',
  minLength: 100,
  skipIfEmpty: true,
}

const EIGHT_K_DISPATCH: Record<string, SectionPromptDispatch> = Object.fromEntries(
  Object.values(EightKSection).map((code) => [code, EIGHT_K_DEFAULT]),
)
EIGHT_K_DISPATCH[EightKSection.SIGNATURE] = PASS

// ─── DEF 14A dispatch ─────────────────────────────────────────────────────

const DEF_14A_DISPATCH: Record<string, SectionPromptDispatch> = {
  [Def14aSection.PROXY]: { promptKind: 'proxy', ...LONG },
  [Def14aSection.EXECUTIVE_COMPENSATION]: { promptKind: 'executive_compensation', ...LONG },
}

// ─── Public API ───────────────────────────────────────────────────────────

const DISPATCH_BY_FILING_TYPE: Record<string, Record<string, SectionPromptDispatch>> = {
  '10-K': TEN_K_DISPATCH,
  '10-Q': TEN_Q_DISPATCH,
  '8-K': EIGHT_K_DISPATCH,
  'DEF 14A': DEF_14A_DISPATCH,
}

/**
 * Look up the prompt dispatch entry for a (filing type, section code) pair.
 * Falls back to a generic 'narrative' kind when the code isn't listed —
 * this keeps the pipeline forward-compatible with new SEC sub-items.
 */
export function getSectionDispatch(
  filingType: string,
  sectionCode: string,
): SectionPromptDispatch {
  return DISPATCH_BY_FILING_TYPE[filingType]?.[sectionCode] ?? DEFAULT_DISPATCH
}

/**
 * Filing-level rollup kinds that don't correspond to any single SEC item.
 * The pipeline writes these to filing_summaries.ai_summary, not to any
 * filing_sections row.
 */
export const ROLLUP_KINDS: ReadonlyArray<SectionPromptKind> = [
  'rollup_executive_summary',
  'rollup_employee_impact',
  'xbrl_income_statement',
  'xbrl_balance_sheet',
  'xbrl_cash_flow',
  'xbrl_shareholders_equity',
] as const

/**
 * Stable identifier for a prompt template version. Stored on
 * filing_sections.prompt_id so we can re-run only the items whose prompt
 * has changed (e.g. risk_factors prompt v2 → mark all risk_factors rows
 * with summary_version = 0 and re-summarise).
 *
 * Bump the version suffix when editing a prompt template's wording.
 */
export const PROMPT_VERSIONS: Record<SectionPromptKind, string> = {
  rollup_executive_summary: 'rollup_executive_summary@v2',
  rollup_employee_impact: 'rollup_employee_impact@v1',
  xbrl_income_statement: 'xbrl_income_statement@v1',
  xbrl_balance_sheet: 'xbrl_balance_sheet@v1',
  xbrl_cash_flow: 'xbrl_cash_flow@v1',
  xbrl_shareholders_equity: 'xbrl_shareholders_equity@v1',
  mda: 'mda@v1',
  risk_factors: 'risk_factors@v1',
  business_overview: 'business_overview@v1',
  legal_proceedings: 'legal_proceedings@v1',
  executive_compensation: 'executive_compensation@v1',
  financial_footnotes: 'financial_footnotes@v1',
  cybersecurity: 'cybersecurity@v1',
  controls_and_procedures: 'controls_and_procedures@v1',
  related_transactions: 'related_transactions@v1',
  proxy: 'proxy@v1',
  event_8k: 'event_8k@v1',
  narrative: 'narrative@v1',
  pass_through: 'pass_through@v1',
}
