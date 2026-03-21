import { useState, useCallback } from 'react'
import { Input, Paragraph, XStack, YStack } from 'tamagui'

interface CurrencyInputProps {
  label: string
  /** Value in cents (integer) */
  value: number | null | undefined
  /** Called with value in cents */
  onValueChange: (cents: number | null) => void
  placeholder?: string
  disabled?: boolean
}

/** Format cents to display string with commas (e.g. 150000 → "1,500") */
function centsToDisplay(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return ''
  const dollars = Math.round(cents / 100)
  return dollars.toLocaleString('en-US')
}

/** Parse display string back to cents (e.g. "1,500" → 150000) */
function displayToCents(display: string): number | null {
  const cleaned = display.replace(/[^0-9]/g, '')
  if (cleaned === '') return null
  const dollars = Number.parseInt(cleaned, 10)
  if (Number.isNaN(dollars)) return null
  return dollars * 100
}

/** Format input as user types — adds commas */
function formatInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '')
  if (digits === '') return ''
  const num = Number.parseInt(digits, 10)
  if (Number.isNaN(num)) return digits
  return num.toLocaleString('en-US')
}

export function CurrencyInput({
  label,
  value,
  onValueChange,
  placeholder = '0',
  disabled = false,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => centsToDisplay(value))

  const handleChange = useCallback(
    (text: string) => {
      const formatted = formatInput(text)
      setDisplayValue(formatted)
      onValueChange(displayToCents(formatted))
    },
    [onValueChange],
  )

  return (
    <YStack gap="$1">
      <Paragraph fontSize={14} fontWeight="500" color="$color11">
        {label}
      </Paragraph>
      <XStack
        bg="$color2"
        rounded="$3"
        borderWidth={1}
        borderColor="$borderColor"
        items="center"
        pl="$3"
      >
        <Paragraph color="$color8" fontSize={16} fontWeight="600">
          $
        </Paragraph>
        <Input
          flex={1}
          value={displayValue}
          onChangeText={handleChange}
          placeholder={placeholder}
          keyboardType="number-pad"
          borderWidth={0}
          backgroundColor="transparent"
          disabled={disabled}
        />
      </XStack>
    </YStack>
  )
}
