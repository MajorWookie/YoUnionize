import { useRouter } from 'expo-router'
import { Button, Paragraph, ScrollView, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import type { ExecutiveData, DirectorData } from '../types'
import { formatDollars, getInitials } from '../format'

interface Props {
  executives: Array<ExecutiveData>
  directors: Array<DirectorData>
  companyTicker: string
  availableFiscalYears?: Array<number>
  selectedFiscalYear?: number | null
  onFiscalYearChange?: (year: number) => void
}

export function LeadershipSection({
  executives,
  directors,
  companyTicker,
  availableFiscalYears,
  selectedFiscalYear,
  onFiscalYearChange,
}: Props) {
  const router = useRouter()
  if (executives.length === 0 && directors.length === 0) return null

  // Dedupe executives by lowercased name (API returns canonical names, lowercase is a safety net)
  const seen = new Map<string, ExecutiveData>()
  for (const exec of executives) {
    const key = exec.name.toLowerCase()
    const existing = seen.get(key)
    if (!existing || exec.totalCompensation > existing.totalCompensation) {
      seen.set(key, exec)
    }
  }
  const top5 = [...seen.values()]
    .sort((a, b) => b.totalCompensation - a.totalCompensation)
    .slice(0, 5)

  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between">
        <Paragraph fontWeight="700" fontSize={16}>
          Leadership
        </Paragraph>
        {selectedFiscalYear != null && (
          <Paragraph color="$color8" fontSize={12}>
            FY {selectedFiscalYear}
          </Paragraph>
        )}
      </XStack>

      {/* Fiscal year selector */}
      {availableFiscalYears != null && availableFiscalYears.length > 1 && onFiscalYearChange && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2" py="$1">
            {availableFiscalYears.map((year) => {
              const isSelected = year === selectedFiscalYear
              return (
                <Button
                  key={year}
                  size="$2"
                  bg={isSelected ? '$color9' : '$color4'}
                  onPress={() => onFiscalYearChange(year)}
                  rounded="$4"
                  px="$3"
                >
                  <Paragraph
                    fontSize={13}
                    fontWeight="600"
                    color={isSelected ? 'white' : '$color11'}
                  >
                    {year}
                  </Paragraph>
                </Button>
              )
            })}
          </XStack>
        </ScrollView>
      )}

      {/* Top Executives */}
      {top5.length > 0 && (
        <YStack gap="$2">
          <Paragraph fontWeight="600" fontSize={14} color="$color8">
            Top Executives
          </Paragraph>
          {top5.map((exec) => (
            <Card
              key={exec.id}
              pressable
              onPress={() => router.push(`/company/${companyTicker}/executive/${exec.id}`)}
            >
              <XStack gap="$3" items="center">
                <YStack
                  width={44}
                  height={44}
                  rounded={22}
                  bg="$color4"
                  items="center"
                  justify="center"
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

                <YStack items="flex-end" gap={2}>
                  <Paragraph fontWeight="700" fontSize={15} color="$color12">
                    {formatDollars(exec.totalCompensation)}
                  </Paragraph>
                  <Paragraph color="$color8" fontSize={11}>
                    FY {exec.fiscalYear}
                  </Paragraph>
                </YStack>
              </XStack>

              {(exec.salary != null || exec.stockAwards != null) && (
                <XStack mt="$2" gap="$3" flexWrap="wrap">
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
                <Paragraph color="$color8" fontSize={12} mt="$2">
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
            const rawYear = dir.tenureStart ? new Date(dir.tenureStart).getFullYear() : null
            const tenureYear = rawYear != null && !Number.isNaN(rawYear) ? rawYear : null

            return (
              <Card
                key={dir.id}
                pressable
                onPress={() => router.push(`/company/${companyTicker}/executive/${dir.id}`)}
              >
                <XStack gap="$3" items="center">
                  <YStack
                    width={44}
                    height={44}
                    rounded={22}
                    bg="$color4"
                    items="center"
                    justify="center"
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
                      px="$2"
                      py="$1"
                      rounded="$2"
                      bg={dir.isIndependent ? '$green3' : '$color3'}
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
                  <XStack mt="$2" gap="$3" flexWrap="wrap" items="center">
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
