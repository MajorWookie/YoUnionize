/**
 * CEO Spotlight Card — highlights the CEO with a brief AI summary and pay ratio.
 * Sits between the Income Breakdown chart and the Executive Summary section.
 */
import { Paragraph, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import type { ExecutiveData, ExecCompSummary } from '../types'
import { formatDollars, getInitials } from '../format'

interface Props {
  executives: Array<ExecutiveData>
  execCompSummary: ExecCompSummary | undefined
}

function findCeo(executives: Array<ExecutiveData>): ExecutiveData | undefined {
  // First pass: look for explicit CEO title
  const ceoByTitle = executives.find((e) =>
    /\bC\.?E\.?O\.?\b|Chief Executive Officer/i.test(e.title),
  )
  if (ceoByTitle) return ceoByTitle

  // Second pass: look for anyone with a CEO pay ratio (only CEOs report this)
  const ceoByRatio = executives.find((e) => e.ceoPayRatio != null)
  if (ceoByRatio) return ceoByRatio

  return undefined
}

export function CeoSpotlightCard({ executives, execCompSummary }: Props) {
  const ceo = findCeo(executives)
  if (!ceo) return null

  const payRatio = ceo.ceoPayRatio ?? execCompSummary?.ceoPayRatio ?? null
  const analysis = execCompSummary?.analysis ?? null

  return (
    <Card>
      <XStack gap="$3" alignItems="center" marginBottom="$3">
        {/* Avatar */}
        <YStack
          width={52}
          height={52}
          borderRadius={26}
          backgroundColor="$blue4"
          alignItems="center"
          justifyContent="center"
        >
          <Paragraph fontWeight="700" color="$blue10" fontSize={18}>
            {getInitials(ceo.name)}
          </Paragraph>
        </YStack>

        <YStack flex={1} gap={2}>
          <Paragraph fontWeight="700" fontSize={17}>
            {ceo.name}
          </Paragraph>
          <Paragraph color="$color8" fontSize={13}>
            {ceo.title}
          </Paragraph>
        </YStack>

        <YStack alignItems="flex-end" gap={2}>
          <Paragraph fontWeight="700" fontSize={16} color="$color12">
            {formatDollars(ceo.totalCompensation)}
          </Paragraph>
          <Paragraph color="$color8" fontSize={11}>
            Total Comp · FY {ceo.fiscalYear}
          </Paragraph>
        </YStack>
      </XStack>

      {/* AI-generated analysis snippet */}
      {analysis && (
        <Paragraph color="$color11" fontSize={14} lineHeight={21} marginBottom="$2">
          {analysis.length > 250 ? `${analysis.slice(0, 247)}...` : analysis}
        </Paragraph>
      )}

      {/* Pay ratio */}
      {payRatio && (
        <XStack
          paddingVertical="$2"
          paddingHorizontal="$3"
          backgroundColor="$color3"
          borderRadius="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <Paragraph fontSize={13} color="$color8">
            CEO-to-Median-Worker Pay Ratio
          </Paragraph>
          <Paragraph fontWeight="700" fontSize={15} color="$color12">
            {payRatio}:1
          </Paragraph>
        </XStack>
      )}
    </Card>
  )
}
