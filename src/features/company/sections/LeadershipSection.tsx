import { Paragraph, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import type { ExecutiveData } from '../types'
import { formatCents, getInitials } from '../format'

interface Props {
  executives: Array<ExecutiveData>
}

export function LeadershipSection({ executives }: Props) {
  if (executives.length === 0) return null

  // Dedupe by name (keep highest comp), take top 5
  const seen = new Map<string, ExecutiveData>()
  for (const exec of executives) {
    const existing = seen.get(exec.name)
    if (!existing || exec.totalCompensation > existing.totalCompensation) {
      seen.set(exec.name, exec)
    }
  }
  const top5 = [...seen.values()]
    .sort((a, b) => b.totalCompensation - a.totalCompensation)
    .slice(0, 5)

  return (
    <YStack gap="$3">
      <Paragraph fontWeight="700" fontSize={16}>
        Leadership
      </Paragraph>
      {top5.map((exec) => (
        <Card key={exec.id}>
          <XStack gap="$3" alignItems="center">
            <YStack
              width={44}
              height={44}
              borderRadius={22}
              backgroundColor="$color4"
              alignItems="center"
              justifyContent="center"
            >
              <Paragraph fontWeight="700" color="$color9" fontSize={15}>
                {getInitials(exec.name)}
              </Paragraph>
            </YStack>

            <YStack flex={1} gap={2}>
              <Paragraph fontWeight="600" fontSize={15}>
                {exec.name}
              </Paragraph>
              <Paragraph color="$color8" fontSize={13}>
                {exec.title}
              </Paragraph>
            </YStack>

            <YStack alignItems="flex-end" gap={2}>
              <Paragraph fontWeight="700" fontSize={15} color="$color12">
                {formatCents(exec.totalCompensation)}
              </Paragraph>
              <Paragraph color="$color8" fontSize={11}>
                FY {exec.fiscalYear}
              </Paragraph>
            </YStack>
          </XStack>

          {(exec.salary != null || exec.stockAwards != null) && (
            <XStack marginTop="$2" gap="$3" flexWrap="wrap">
              {exec.salary != null && (
                <YStack>
                  <Paragraph color="$color8" fontSize={11}>Salary</Paragraph>
                  <Paragraph fontSize={13} fontWeight="500">{formatCents(exec.salary)}</Paragraph>
                </YStack>
              )}
              {exec.bonus != null && exec.bonus > 0 && (
                <YStack>
                  <Paragraph color="$color8" fontSize={11}>Bonus</Paragraph>
                  <Paragraph fontSize={13} fontWeight="500">{formatCents(exec.bonus)}</Paragraph>
                </YStack>
              )}
              {exec.stockAwards != null && (
                <YStack>
                  <Paragraph color="$color8" fontSize={11}>Stock Awards</Paragraph>
                  <Paragraph fontSize={13} fontWeight="500">{formatCents(exec.stockAwards)}</Paragraph>
                </YStack>
              )}
              {exec.optionAwards != null && exec.optionAwards > 0 && (
                <YStack>
                  <Paragraph color="$color8" fontSize={11}>Options</Paragraph>
                  <Paragraph fontSize={13} fontWeight="500">{formatCents(exec.optionAwards)}</Paragraph>
                </YStack>
              )}
            </XStack>
          )}

          {exec.ceoPayRatio != null && (
            <Paragraph color="$color8" fontSize={12} marginTop="$2">
              CEO-to-median-worker pay ratio: {exec.ceoPayRatio}:1
            </Paragraph>
          )}
        </Card>
      ))}
    </YStack>
  )
}
