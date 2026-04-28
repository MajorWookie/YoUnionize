import { Paragraph, YStack } from 'tamagui'
import { Select } from 'tamagui'
import { useMemo, useState } from 'react'

interface SelectFieldProps {
  label: string
  value: string | null | undefined
  onValueChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  placeholder?: string
  disabled?: boolean
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  disabled = false,
}: SelectFieldProps) {
  return (
    <YStack gap="$1">
      <Paragraph fontSize={14} fontWeight="500" color="$color11">
        {label}
      </Paragraph>
      <Select
        value={value ?? ''}
        onValueChange={onValueChange}
        disablePreventBodyScroll
      >
        <Select.Trigger
          disabled={disabled}
          backgroundColor="$color2"
          borderColor="$borderColor"
        >
          <Select.Value placeholder={placeholder} />
        </Select.Trigger>

        <Select.Content>
          <Select.Viewport>
            {options.map((opt, idx) => (
              <Select.Item key={opt.value} value={opt.value} index={idx}>
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select>
    </YStack>
  )
}
