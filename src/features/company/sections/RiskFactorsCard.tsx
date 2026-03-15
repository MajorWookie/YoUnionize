import { Paragraph, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { TextSummaryCard } from './TextSummaryCard'
import type { FilingSummaryResult, ExecCompSummary } from '../types'

interface Props {
  riskFactorsSummary: string | null | undefined
  redFlags: string[] | undefined
  opportunities: string[] | undefined
  /** From the exec comp summary — whether employee comp is flagged as a risk */
  execCompSummary?: ExecCompSummary | null
}

export function RiskFactorsCard({
  riskFactorsSummary,
  redFlags,
  opportunities,
  execCompSummary,
}: Props) {
  if (!riskFactorsSummary && (!redFlags || redFlags.length === 0)) return null

  return (
    <YStack gap="$3">
      <TextSummaryCard title="Risk Factors" content={riskFactorsSummary}>
        {redFlags && redFlags.length > 0 && (
          <YStack marginTop="$3" gap="$2">
            <Paragraph fontWeight="600" color="$negative" fontSize={14}>
              Red Flags
            </Paragraph>
            {redFlags.map((flag, i) => (
              <Paragraph key={i} color="$color11" fontSize={13} lineHeight={20}>
                {'\u2022'} {flag}
              </Paragraph>
            ))}
          </YStack>
        )}

        {opportunities && opportunities.length > 0 && (
          <YStack marginTop="$3" gap="$2">
            <Paragraph fontWeight="600" color="$positive" fontSize={14}>
              Opportunities
            </Paragraph>
            {opportunities.map((opp, i) => (
              <Paragraph key={i} color="$color11" fontSize={13} lineHeight={20}>
                {'\u2022'} {opp}
              </Paragraph>
            ))}
          </YStack>
        )}
      </TextSummaryCard>

      {execCompSummary && !execCompSummary.employeeCompAsRiskFactor && (
        <Card>
          <Paragraph color="$color9" fontSize={13} fontWeight="600">
            Note: Employee compensation is not listed as a risk factor in this filing.
          </Paragraph>
        </Card>
      )}
    </YStack>
  )
}
