import { Paragraph, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import type { ExecutiveData, DirectorData } from '../types'
import { formatDollars, getInitials } from '../format'

interface Props {
  executives: Array<ExecutiveData>
  directors: Array<DirectorData>
}

export function LeadershipSection({ executives, directors }: Props) {
  if (executives.length === 0 && directors.length === 0) return null

  // Dedupe executives by name (keep highest comp), take top 5
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

      {/* Top Executives */}
      {top5.length > 0 && (
        <YStack gap="$2">
          <Paragraph fontWeight="600" fontSize={14} color="$color8">
            Top Executives
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
                    {formatDollars(exec.totalCompensation)}
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
                      <Paragraph fontSize={13} fontWeight="500">{formatDollars(exec.salary)}</Paragraph>
                    </YStack>
                  )}
                  {exec.bonus != null && exec.bonus > 0 && (
                    <YStack>
                      <Paragraph color="$color8" fontSize={11}>Bonus</Paragraph>
                      <Paragraph fontSize={13} fontWeight="500">{formatDollars(exec.bonus)}</Paragraph>
                    </YStack>
                  )}
                  {exec.stockAwards != null && (
                    <YStack>
                      <Paragraph color="$color8" fontSize={11}>Stock Awards</Paragraph>
                      <Paragraph fontSize={13} fontWeight="500">{formatDollars(exec.stockAwards)}</Paragraph>
                    </YStack>
                  )}
                  {exec.optionAwards != null && exec.optionAwards > 0 && (
                    <YStack>
                      <Paragraph color="$color8" fontSize={11}>Options</Paragraph>
                      <Paragraph fontSize={13} fontWeight="500">{formatDollars(exec.optionAwards)}</Paragraph>
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
      )}

      {/* Board of Directors */}
      {directors.length > 0 && (
        <YStack gap="$2">
          <Paragraph fontWeight="600" fontSize={14} color="$color8">
            Board of Directors
          </Paragraph>
          {directors.map((dir) => {
            const committees = Array.isArray(dir.committees) ? dir.committees as Array<string> : []
            const tenureYear = dir.tenureStart ? new Date(dir.tenureStart).getFullYear() : null

            return (
              <Card key={dir.id}>
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
                      {getInitials(dir.name)}
                    </Paragraph>
                  </YStack>

                  <YStack flex={1} gap={2}>
                    <Paragraph fontWeight="600" fontSize={15}>
                      {dir.name}
                    </Paragraph>
                    <Paragraph color="$color8" fontSize={13}>
                      {dir.title}
                    </Paragraph>
                  </YStack>

                  {dir.isIndependent != null && (
                    <YStack
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                      borderRadius="$2"
                      backgroundColor={dir.isIndependent ? '$green3' : '$color3'}
                    >
                      <Paragraph
                        fontSize={11}
                        fontWeight="600"
                        color={dir.isIndependent ? '$green10' : '$color8'}
                      >
                        {dir.isIndependent ? 'Independent' : 'Non-Independent'}
                      </Paragraph>
                    </YStack>
                  )}
                </XStack>

                {(committees.length > 0 || tenureYear) && (
                  <XStack marginTop="$2" gap="$3" flexWrap="wrap" alignItems="center">
                    {tenureYear != null && !isNaN(tenureYear) && (
                      <Paragraph color="$color8" fontSize={12}>
                        Since {tenureYear}
                      </Paragraph>
                    )}
                    {committees.length > 0 && (
                      <Paragraph color="$color8" fontSize={12} flex={1} numberOfLines={1}>
                        {committees.join(', ')}
                      </Paragraph>
                    )}
                  </XStack>
                )}
              </Card>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}
