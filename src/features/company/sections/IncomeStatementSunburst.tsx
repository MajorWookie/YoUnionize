/**
 * Interactive income statement sunburst chart section.
 *
 * Renders a multi-ring donut chart showing revenue disposition:
 *   Ring 1 (outer): Revenue sub-categories (if breakdown exists)
 *   Ring 2 (middle): Operating Expenses vs Operating Income
 *   Ring 3 (inner): Interest, Non-Operating, Tax, Net Income
 *
 * Includes year toggle (if prior year data exists), tap-to-inspect popover,
 * and graceful degradation when data is insufficient.
 */
import { useState, useMemo, useCallback } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { Button, Paragraph, ScrollView, XStack, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { SunburstChart } from '~/interface/charts/SunburstChart'
import {
  extractSunburstYears,
  type SunburstSlice,
  type SunburstYearData,
} from '../lib/income-data-extractor'
import type { FinancialStatement } from '../types'
import { formatFinancial } from '../format'

interface Props {
  summary: Record<string, unknown>
  periodEnd?: string | null
}

export function IncomeStatementSunburst({ summary, periodEnd }: Props) {
  const statement = summary.income_statement as FinancialStatement | undefined
  if (!statement?.items?.length) {
    return null
  }

  return <SunburstContent statement={statement} periodEnd={periodEnd} />
}

function SunburstContent({ statement, periodEnd }: { statement: FinancialStatement; periodEnd?: string | null }) {
  const allYears = useMemo(() => extractSunburstYears(statement, periodEnd), [statement, periodEnd])
  const [selectedYearIdx, setSelectedYearIdx] = useState(0)
  const [activeSlice, setActiveSlice] = useState<SunburstSlice | null>(null)

  // Graceful degradation: no usable data
  if (allYears.length === 0) {
    return <FallbackCard statement={statement} />
  }

  const currentData = allYears[selectedYearIdx] ?? allYears[0]

  // Check minimum slice count (across all rings)
  const totalSlices = currentData.rings.reduce((sum, r) => sum + r.slices.length, 0)
  if (totalSlices < 2) {
    return <FallbackCard statement={statement} />
  }

  return (
    <YStack gap="$2">
      <Paragraph fontWeight="700" fontSize={16}>
        Income Breakdown
      </Paragraph>

      <Card>
        {/* Year toggle */}
        {allYears.length > 1 && (
          <YearToggle
            years={allYears}
            selectedIndex={selectedYearIdx}
            onSelect={(idx) => {
              setSelectedYearIdx(idx)
              setActiveSlice(null)
            }}
          />
        )}

        {/* Chart */}
        <SunburstChart
          rings={currentData.rings}
          size={290}
          centerValue={currentData.formattedRevenue}
          centerLabel="Revenue"
          activeSliceId={activeSlice?.id ?? null}
          onSlicePress={(slice) => {
            setActiveSlice((prev) => (prev?.id === slice.id ? null : slice))
          }}
        />

        {/* Legend */}
        <RingLegend data={currentData} activeSliceId={activeSlice?.id ?? null} onPress={setActiveSlice} />

        {/* Slice detail popover */}
        {activeSlice && (
          <SlicePopover
            slice={activeSlice}
            totalRevenue={currentData.totalRevenue}
            onClose={() => setActiveSlice(null)}
          />
        )}
      </Card>
    </YStack>
  )
}

// ── Year Toggle ────────────────────────────────────────────────────────

function YearToggle({
  years,
  selectedIndex,
  onSelect,
}: {
  years: SunburstYearData[]
  selectedIndex: number
  onSelect: (idx: number) => void
}) {
  return (
    <XStack gap="$2" mb="$3" justify="center">
      {years.map((y, idx) => (
        <Button
          key={y.year}
          size="$2"
          theme={idx === selectedIndex ? 'accent' : undefined}
          variant={idx === selectedIndex ? undefined : 'outlined'}
          onPress={() => onSelect(idx)}
        >
          {y.periodLabel}
        </Button>
      ))}
    </XStack>
  )
}

// ── Ring Legend ─────────────────────────────────────────────────────────

function RingLegend({
  data,
  activeSliceId,
  onPress,
}: {
  data: SunburstYearData
  activeSliceId: string | null
  onPress: (slice: SunburstSlice | null) => void
}) {
  // Show key slices from Ring 2 and Ring 3 (skip Ring 1 revenue sub-items in legend)
  const legendRings = data.rings.length > 2 ? data.rings.slice(1) : data.rings
  const legendSlices = legendRings.flatMap((r) => r.slices)

  return (
    <YStack gap="$1.5" mt="$3">
      {legendSlices.map((slice) => {
        const isActive = activeSliceId === slice.id
        return (
          <Pressable
            key={slice.id}
            onPress={() => onPress(isActive ? null : slice)}
          >
            <XStack
              items="center"
              justify="space-between"
              opacity={activeSliceId != null && !isActive ? 0.5 : 1}
              py="$1"
            >
              <XStack items="center" gap="$2" flex={1}>
                <YStack
                  width={10}
                  height={10}
                  rounded={2}
                  bg={slice.color as any}
                />
                <Paragraph fontSize={13} color="$color11" numberOfLines={1}>
                  {slice.isNegative ? '\u2193 ' : ''}
                  {slice.label}
                </Paragraph>
              </XStack>
              <XStack gap="$2" items="center">
                <Paragraph fontSize={13} fontWeight="600" color="$color12">
                  {slice.formattedValue}
                </Paragraph>
                <Paragraph fontSize={12} color="$color8" width={45} text="right">
                  {slice.percentOfRevenue}%
                </Paragraph>
              </XStack>
            </XStack>
          </Pressable>
        )
      })}
    </YStack>
  )
}

// ── Slice Popover ──────────────────────────────────────────────────────

function SlicePopover({
  slice,
  totalRevenue,
  onClose,
}: {
  slice: SunburstSlice
  totalRevenue: number
  onClose: () => void
}) {
  return (
    <YStack
      mt="$3"
      p="$3"
      bg="$color3"
      rounded="$3"
      borderWidth={1}
      borderColor="$borderColor"
    >
      {/* Header */}
      <XStack justify="space-between" items="center" mb="$2">
        <XStack items="center" gap="$2">
          <YStack
            width={12}
            height={12}
            rounded={3}
            bg={slice.color as any}
          />
          <Paragraph fontWeight="700" fontSize={15}>
            {slice.label}
          </Paragraph>
        </XStack>
        <Pressable onPress={onClose} hitSlop={12}>
          <Paragraph fontSize={16} color="$color8">
            {'\u2715'}
          </Paragraph>
        </Pressable>
      </XStack>

      {/* Value and percent */}
      <XStack gap="$4" mb={slice.breakdown ? '$3' : 0}>
        <YStack>
          <Paragraph color="$color8" fontSize={11}>
            Value
          </Paragraph>
          <Paragraph fontWeight="700" fontSize={17} color="$color12">
            {slice.formattedValue}
          </Paragraph>
        </YStack>
        <YStack>
          <Paragraph color="$color8" fontSize={11}>
            % of Revenue
          </Paragraph>
          <Paragraph fontWeight="700" fontSize={17} color="$color12">
            {slice.percentOfRevenue}%
          </Paragraph>
        </YStack>
      </XStack>

      {/* Negative indicator */}
      {slice.isNegative && (
        <Paragraph color="$color8" fontSize={12} mb="$2">
          {'\u2193'} Reduces income — this is a cost deducted from operating results
        </Paragraph>
      )}

      {/* Operating Expenses breakdown */}
      {slice.breakdown && slice.breakdown.length > 0 && (
        <YStack gap="$1" borderTopWidth={1} borderTopColor="$borderColor" pt="$2">
          <Paragraph fontWeight="600" fontSize={13} color="$color8" mb="$1">
            Expense Breakdown
          </Paragraph>
          <ScrollView maxH={180} showsVerticalScrollIndicator={false}>
            <YStack gap="$1">
              {slice.breakdown.map((item) => (
                <XStack key={item.label} justify="space-between" items="center">
                  <Paragraph fontSize={13} color="$color11" flex={1} numberOfLines={1}>
                    {item.label}
                  </Paragraph>
                  <XStack gap="$2" items="center">
                    <Paragraph fontSize={13} fontWeight="600" color="$color12">
                      {item.formattedValue}
                    </Paragraph>
                    <Paragraph fontSize={12} color="$color8" width={42} text="right">
                      {item.percentOfRevenue}%
                    </Paragraph>
                  </XStack>
                </XStack>
              ))}
            </YStack>
          </ScrollView>
        </YStack>
      )}
    </YStack>
  )
}

// ── Fallback Card ──────────────────────────────────────────────────────

function FallbackCard({ statement }: { statement: FinancialStatement }) {
  const revenue = statement.items.find((i) =>
    /^(total\s+)?(net\s+)?(revenue|sales)$/i.test(i.label),
  )
  const netIncome = statement.items.find((i) =>
    /^net\s+(income|loss|earnings)/i.test(i.label),
  )

  if (!revenue?.current) {
    return (
      <Card>
        <Paragraph fontWeight="600" color="$color8">
          Financial breakdown unavailable
        </Paragraph>
      </Card>
    )
  }

  return (
    <YStack gap="$2">
      <Paragraph fontWeight="700" fontSize={16}>
        Income Breakdown
      </Paragraph>
      <Card>
        <Paragraph color="$color8" fontSize={12} mb="$2">
          Detailed breakdown unavailable
        </Paragraph>
        <XStack gap="$4">
          <YStack>
            <Paragraph color="$color8" fontSize={11}>
              Total Revenue
            </Paragraph>
            <Paragraph fontWeight="700" fontSize={18} color="$color12">
              {formatFinancial(revenue.current)}
            </Paragraph>
          </YStack>
          {netIncome?.current != null && (
            <YStack>
              <Paragraph color="$color8" fontSize={11}>
                {netIncome.current >= 0 ? 'Net Income' : 'Net Loss'}
              </Paragraph>
              <Paragraph
                fontWeight="700"
                fontSize={18}
                color={netIncome.current >= 0 ? '$positive' : '$negative'}
              >
                {formatFinancial(netIncome.current)}
              </Paragraph>
            </YStack>
          )}
        </XStack>
      </Card>
    </YStack>
  )
}
