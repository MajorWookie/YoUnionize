import { describe, expect, it } from 'vitest'
import * as live from '@younionize/ai'
import { V1_SECTION_PROMPTS, V1_KINDS, type V1Kind } from '../v1-section-prompts'

/**
 * Asserts the v1 fixture matches the live module bodies byte-for-byte
 * AT SNAPSHOT TIME. After Phase 3 swaps a Council Workbench prompt into
 * a live module, the corresponding entry below must be deleted from the
 * `expect-equal` set — the fixture is intentionally frozen-in-time and
 * the live module has moved on.
 */

interface LiveBuilders {
  system: () => string
  user: (p: { section: string; companyName: string; filingType: string }) => string
}

const SAMPLE_PARAMS = {
  section: 'Lorem ipsum sample section content for byte-equality test.',
  companyName: 'Acme Corp',
  filingType: '10-K',
}

const LIVE_BUILDERS: Record<V1Kind, LiveBuilders> = {
  business_overview: {
    system: live.businessOverviewSummarySystemPrompt,
    user: live.businessOverviewSummaryUserPrompt,
  },
  risk_factors: {
    system: live.riskFactorsSummarySystemPrompt,
    user: live.riskFactorsSummaryUserPrompt,
  },
  legal_proceedings: {
    system: live.legalProceedingsSummarySystemPrompt,
    user: live.legalProceedingsSummaryUserPrompt,
  },
  financial_footnotes: {
    system: live.financialFootnotesSummarySystemPrompt,
    user: live.financialFootnotesSummaryUserPrompt,
  },
  executive_compensation: {
    system: live.executiveCompensationSummarySystemPrompt,
    user: live.executiveCompensationSummaryUserPrompt,
  },
  cybersecurity: {
    system: live.cybersecuritySummarySystemPrompt,
    user: live.cybersecuritySummaryUserPrompt,
  },
  controls_and_procedures: {
    system: live.controlsAndProceduresSummarySystemPrompt,
    user: live.controlsAndProceduresSummaryUserPrompt,
  },
  related_transactions: {
    system: live.relatedTransactionsSummarySystemPrompt,
    user: live.relatedTransactionsSummaryUserPrompt,
  },
  proxy: {
    system: live.proxySummarySystemPrompt,
    user: live.proxySummaryUserPrompt,
  },
  event_8k: {
    system: live.event8kSummarySystemPrompt,
    user: live.event8kSummaryUserPrompt,
  },
  narrative: {
    system: live.narrativeSummarySystemPrompt,
    user: live.narrativeSummaryUserPrompt,
  },
  mda: {
    system: live.mdaSummarySystemPrompt,
    // mda's user prompt takes mdaText not section — adapt for the test.
    user: (p) =>
      live.mdaSummaryUserPrompt({
        companyName: p.companyName,
        filingType: p.filingType,
        mdaText: p.section,
      }),
  },
}

/**
 * Sections whose v1 fixture is still expected to match the live module.
 * As Phase 3 lands per-section Council prompt swaps, the corresponding
 * entry must be REMOVED from this set — the fixture is intentionally
 * frozen, so divergence from the live module is the expected post-swap
 * state.
 */
const EXPECT_BYTE_EQUAL: ReadonlySet<V1Kind> = new Set<V1Kind>([
  'business_overview',
  'risk_factors',
  'legal_proceedings',
  'financial_footnotes',
  'executive_compensation',
  'cybersecurity',
  'controls_and_procedures',
  'related_transactions',
  'proxy',
  'event_8k',
  'narrative',
  'mda',
])

describe('v1 section-prompts fixture', () => {
  it.each(V1_KINDS)(
    '%s: fixture system prompt matches live module (until Phase 3 swap)',
    (kind) => {
      if (!EXPECT_BYTE_EQUAL.has(kind)) {
        // Phase 3 has shipped a new prompt for this kind — fixture is
        // intentionally frozen at v1; skip the equality check.
        return
      }
      const fixtureSystem = V1_SECTION_PROMPTS[kind].system
      const liveSystem = LIVE_BUILDERS[kind].system()
      expect(fixtureSystem).toBe(liveSystem)
    },
  )

  it.each(V1_KINDS)(
    '%s: fixture user prompt matches live module (until Phase 3 swap)',
    (kind) => {
      if (!EXPECT_BYTE_EQUAL.has(kind)) return
      const fixtureUser = V1_SECTION_PROMPTS[kind].user(SAMPLE_PARAMS)
      const liveUser = LIVE_BUILDERS[kind].user(SAMPLE_PARAMS)
      expect(fixtureUser).toBe(liveUser)
    },
  )

  it('exposes one entry per declared kind', () => {
    expect(Object.keys(V1_SECTION_PROMPTS).sort()).toEqual([...V1_KINDS].sort())
  })
})
