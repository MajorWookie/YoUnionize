/**
 * Executive / Director detail screen.
 * Shows full profile, compensation breakdown (executives), committee memberships (directors),
 * and qualifications from proxy statement data.
 */
import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Button, Paragraph, Separator, XStack, YStack } from 'tamagui'
import { ScreenContainer } from '~/interface/layout/ScreenContainer'
import { Card } from '~/interface/display/Card'
import { LoadingState } from '~/interface/display/LoadingState'
import { ErrorState } from '~/interface/display/ErrorState'
import { extractErrorMessage, fetchWithRetry } from '~/lib/api-client'
import { formatDollars, getInitials } from '~/features/company/format'
import type {
  CompanyDetailResponse,
  ExecutiveData,
  DirectorData,
} from '~/features/company/types'

type PersonKind = 'executive' | 'director' | 'both'

interface ResolvedPerson {
  kind: PersonKind
  executive: ExecutiveData | null
  director: DirectorData | null
  name: string
  title: string
}

function resolvePerson(data: CompanyDetailResponse, id: string): ResolvedPerson | null {
  const exec = data.executives.find((e) => e.id === id) ?? null
  const dir = data.directors.find((d) => d.id === id) ?? null

  if (!exec && !dir) return null

  // A person may be both an executive and a director — cross-match by name
  const name = exec?.name ?? dir?.name ?? ''
  const matchedDir = dir ?? data.directors.find((d) => d.name === name) ?? null
  const matchedExec = exec ?? data.executives.find((e) => e.name === name) ?? null

  const kind: PersonKind =
    matchedExec && matchedDir ? 'both' : matchedExec ? 'executive' : 'director'

  return {
    kind,
    executive: matchedExec,
    director: matchedDir,
    name,
    title: exec?.title ?? dir?.title ?? '',
  }
}

export default function ExecutiveDetailScreen() {
  const params = useLocalSearchParams<{ ticker: string; id: string }>()
  const router = useRouter()
  const ticker = params.ticker?.toUpperCase() ?? ''
  const personId = params.id ?? ''

  const [data, setData] = useState<CompanyDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithRetry(`/api/companies/${ticker}/detail`)
      if (!res.ok) {
        const errData = await res.json()
        setError(extractErrorMessage(errData))
        setLoading(false)
        return
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading profile..." />
      </ScreenContainer>
    )
  }

  if (error || !data) {
    return (
      <ScreenContainer>
        <ErrorState message={error ?? 'Failed to load'} onRetry={fetchDetail} />
      </ScreenContainer>
    )
  }

  const person = resolvePerson(data, personId)

  if (!person) {
    return (
      <ScreenContainer>
        <ErrorState message="Person not found" onRetry={() => router.back()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <Button
        size="$2"
        variant="outlined"
        onPress={() => router.back()}
        alignSelf="flex-start"
        marginBottom="$2"
      >
        {'\u2190'} Back to {data.company.name}
      </Button>

      {/* Header */}
      <XStack gap="$3" alignItems="center" marginBottom="$4">
        <YStack
          width={60}
          height={60}
          borderRadius={30}
          backgroundColor="$blue4"
          alignItems="center"
          justifyContent="center"
        >
          <Paragraph fontWeight="700" color="$blue10" fontSize={22}>
            {getInitials(person.name)}
          </Paragraph>
        </YStack>
        <YStack flex={1} gap={2}>
          <Paragraph fontWeight="700" fontSize={20}>
            {person.name}
          </Paragraph>
          <Paragraph color="$color8" fontSize={14}>
            {person.title}
          </Paragraph>
          <Paragraph color="$color8" fontSize={12}>
            {data.company.name} · {data.company.ticker}
          </Paragraph>
        </YStack>
      </XStack>

      <YStack gap="$4" paddingBottom="$6">
        {/* Tenure */}
        {person.director?.tenureStart && (
          <Card>
            <Paragraph fontWeight="600" marginBottom="$1">Tenure</Paragraph>
            <Paragraph color="$color11">
              Board member since {new Date(person.director.tenureStart).getFullYear()}
              {person.director.age ? ` · Age ${person.director.age}` : ''}
            </Paragraph>
            {person.director.directorClass && (
              <Paragraph color="$color8" fontSize={13} marginTop="$1">
                {person.director.directorClass}
              </Paragraph>
            )}
          </Card>
        )}

        {/* Independence & Role */}
        {person.director && (
          <XStack gap="$2" flexWrap="wrap">
            {person.director.isIndependent != null && (
              <YStack
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius="$3"
                backgroundColor={person.director.isIndependent ? '$green3' : '$color3'}
              >
                <Paragraph
                  fontSize={13}
                  fontWeight="600"
                  color={person.director.isIndependent ? '$green10' : '$color8'}
                >
                  {person.director.isIndependent ? 'Independent Director' : 'Non-Independent Director'}
                </Paragraph>
              </YStack>
            )}
            {person.director.role && (
              <YStack
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius="$3"
                backgroundColor="$color3"
              >
                <Paragraph fontSize={13} fontWeight="600" color="$color8">
                  {person.director.role}
                </Paragraph>
              </YStack>
            )}
          </XStack>
        )}

        {/* Committee Memberships (directors) */}
        <CommitteesCard director={person.director} />

        {/* Compensation Breakdown (executives) */}
        <CompensationCard executive={person.executive} />

        {/* Qualifications / Bio from proxy data */}
        <QualificationsCard director={person.director} />
      </YStack>
    </ScreenContainer>
  )
}

function CommitteesCard({ director }: { director: DirectorData | null }) {
  if (!director) return null
  const committees = Array.isArray(director.committees) ? (director.committees as Array<string>) : []
  if (committees.length === 0) return null

  return (
    <Card>
      <Paragraph fontWeight="600" marginBottom="$2">
        Committee Memberships
      </Paragraph>
      <YStack gap="$1.5">
        {committees.map((c) => (
          <XStack key={c} gap="$2" alignItems="center">
            <YStack width={6} height={6} borderRadius={3} backgroundColor="$blue8" />
            <Paragraph color="$color11" fontSize={14}>
              {c}
            </Paragraph>
          </XStack>
        ))}
      </YStack>
    </Card>
  )
}

function CompensationCard({ executive }: { executive: ExecutiveData | null }) {
  if (!executive) return null

  const items: Array<{ label: string; value: number | null }> = [
    { label: 'Base Salary', value: executive.salary },
    { label: 'Bonus', value: executive.bonus },
    { label: 'Stock Awards', value: executive.stockAwards },
    { label: 'Option Awards', value: executive.optionAwards },
    { label: 'Non-Equity Incentive', value: executive.nonEquityIncentive },
    { label: 'Change in Pension Value', value: executive.changeInPensionValue },
    { label: 'Other Compensation', value: executive.otherCompensation },
  ]

  const nonZeroItems = items.filter((i) => i.value != null && i.value > 0)

  return (
    <Card>
      <Paragraph fontWeight="600" marginBottom="$1">
        Compensation Breakdown
      </Paragraph>
      <Paragraph color="$color8" fontSize={12} marginBottom="$3">
        FY {executive.fiscalYear}
      </Paragraph>

      {/* Total */}
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
        <Paragraph fontWeight="600" fontSize={15}>Total Compensation</Paragraph>
        <Paragraph fontWeight="700" fontSize={18} color="$color12">
          {formatDollars(executive.totalCompensation)}
        </Paragraph>
      </XStack>

      <Separator marginBottom="$2" />

      {/* Line items */}
      <YStack gap="$2">
        {nonZeroItems.map((item) => {
          const pct = executive.totalCompensation > 0
            ? ((item.value! / executive.totalCompensation) * 100).toFixed(1)
            : '0'
          return (
            <XStack key={item.label} justifyContent="space-between" alignItems="center">
              <Paragraph color="$color11" fontSize={14} flex={1}>
                {item.label}
              </Paragraph>
              <XStack gap="$2" alignItems="center">
                <Paragraph fontWeight="600" fontSize={14} color="$color12">
                  {formatDollars(item.value)}
                </Paragraph>
                <Paragraph color="$color8" fontSize={12} width={45} textAlign="right">
                  {pct}%
                </Paragraph>
              </XStack>
            </XStack>
          )
        })}
      </YStack>

      {executive.ceoPayRatio && (
        <>
          <Separator marginVertical="$2" />
          <XStack justifyContent="space-between" alignItems="center">
            <Paragraph color="$color8" fontSize={13}>CEO-to-Median-Worker Pay Ratio</Paragraph>
            <Paragraph fontWeight="700" fontSize={14} color="$color12">
              {executive.ceoPayRatio}:1
            </Paragraph>
          </XStack>
        </>
      )}
    </Card>
  )
}

function QualificationsCard({ director }: { director: DirectorData | null }) {
  if (!director) return null

  const quals = director.qualifications
  if (!quals) return null

  // qualifications can be a string or array of strings from the proxy data
  let content: string
  if (typeof quals === 'string') {
    content = quals
  } else if (Array.isArray(quals)) {
    content = (quals as Array<string>).join('\n')
  } else {
    return null
  }

  if (!content.trim()) return null

  return (
    <Card>
      <Paragraph fontWeight="600" marginBottom="$2">
        Background & Qualifications
      </Paragraph>
      <Paragraph color="$color11" fontSize={14} lineHeight={21}>
        {content}
      </Paragraph>
    </Card>
  )
}
