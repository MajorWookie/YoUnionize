import { Input, Paragraph, YStack } from 'tamagui'

interface TextFieldProps {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  disabled?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  disabled = false,
  autoCapitalize,
}: TextFieldProps) {
  return (
    <YStack gap="$1">
      <Paragraph fontSize={14} fontWeight="500" color="$color11">
        {label}
      </Paragraph>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        disabled={disabled}
        autoCapitalize={autoCapitalize}
        backgroundColor="$color2"
        borderColor="$borderColor"
      />
    </YStack>
  )
}
