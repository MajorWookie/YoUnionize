import { Paragraph, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { Stat } from '~/interface/display/Stat'
import type { CompanySummaryResult, FilingSummaryResult } from '../types'
import { formatDate } from '../format'

interface Props {
  summary: CompanySummaryResult | FilingSummaryResult
  periodEnd: string | null
  filingType: string
}

function isV2Summary(s: CompanySummaryResult | FilingSummaryResult): s is CompanySummaryResult {
  return 'headline' in s
}

export function CompanySummaryCard({ summary, periodEnd, filingType }: Props) {
  const v2 = isV2Summary(summary)

  const mainText = v2 ? summary.company_health : summary.executive_summary
  const headline = v2 ? summary.headline : null
  const keyNumbers = summary.key_numbers ?? []
  const whatThisMeans = v2 ? null : (summary as FilingSummaryResult).plain_language_explanation
  const employeeRelevance = v2 ? null : (summary as FilingSummaryResult).employee_relevance

  return (
    <YStack gap="$3">
      <Card>
        <Paragraph fontWeight="700" fontSize={16} mb="$2">
          Company Summary
        </Paragraph>
        <Paragraph color="$color8" fontSize={12} mb="$3">
          {filingType} · {periodEnd ? formatDate(periodEnd) : 'Recent filing'}
        </Paragraph>
        {headline && (
          <Paragraph fontWeight="600" fontSize={15} mb="$2" color="$color12">
            {headline}
          </Paragraph>
        )}
        <Paragraph color="$color11" lineHeight={22}>
          {mainText}
        </Paragraph>
      </Card>

      {keyNumbers.length > 0 && (
        <XStack flexWrap="wrap" gap="$3">
          {keyNumbers.slice(0, 6).map((kn) => (
            <YStack key={kn.label} flex={1} minW={140}>
              <Card>
                <Stat label={kn.label} value={kn.value} />
                <Paragraph color="$color8" fontSize={11} mt="$1">
                  {kn.context}
                </Paragraph>
              </Card>
            </YStack>
          ))}
        </XStack>
      )}

      {whatThisMeans && (
        <Card>
          <Paragraph fontWeight="600" mb="$2">
            What does this mean?
          </Paragraph>
          <Paragraph color="$color11" lineHeight={22}>
            {whatThisMeans}
          </Paragraph>
        </Card>
      )}

      {employeeRelevance && (
        <Card>
          <Paragraph fontWeight="600" mb="$2">
            What this may mean for employees
          </Paragraph>
          <Paragraph color="$color11" lineHeight={22}>
            {employeeRelevance}
          </Paragraph>
        </Card>
      )}
    </YStack>
  )
}
