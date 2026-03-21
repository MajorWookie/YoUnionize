import { Paragraph, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { Stat } from '~/interface/display/Stat'
import type { FilingSummaryResult } from '../types'
import { formatDate } from '../format'

interface Props {
  summary: FilingSummaryResult
  periodEnd: string | null
  filingType: string
}

export function ExecutiveSummaryCard({ summary, periodEnd, filingType }: Props) {
  return (
    <YStack gap="$3">
      <Card>
        <Paragraph fontWeight="700" fontSize={16} mb="$2">
          Executive Summary
        </Paragraph>
        <Paragraph color="$color8" fontSize={12} mb="$3">
          {filingType} · {periodEnd ? formatDate(periodEnd) : 'Recent filing'}
        </Paragraph>
        <Paragraph color="$color11" lineHeight={22}>
          {summary.executive_summary}
        </Paragraph>
      </Card>

      {summary.key_numbers.length > 0 && (
        <XStack flexWrap="wrap" gap="$3">
          {summary.key_numbers.slice(0, 4).map((kn) => (
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

      {summary.plain_language_explanation && (
        <Card>
          <Paragraph fontWeight="600" mb="$2">
            What does this mean?
          </Paragraph>
          <Paragraph color="$color11" lineHeight={22}>
            {summary.plain_language_explanation}
          </Paragraph>
        </Card>
      )}

      {summary.employee_relevance && (
        <Card>
          <Paragraph fontWeight="600" mb="$2">
            What this may mean for employees
          </Paragraph>
          <Paragraph color="$color11" lineHeight={22}>
            {summary.employee_relevance}
          </Paragraph>
        </Card>
      )}
    </YStack>
  )
}
