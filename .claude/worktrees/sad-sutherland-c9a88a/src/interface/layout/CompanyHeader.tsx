import { H3, Paragraph, XStack, YStack } from 'tamagui'

interface CompanyHeaderProps {
  name: string
  ticker: string
  sector?: string | null
}

export function CompanyHeader({ name, ticker, sector }: CompanyHeaderProps) {
  return (
    <XStack items="center" gap="$3" py="$3">
      {/* Placeholder logo circle */}
      <YStack
        width={48}
        height={48}
        rounded={24}
        bg="$color9"
        items="center"
        justify="center"
      >
        <Paragraph color="white" fontWeight="700" fontSize={18}>
          {ticker.slice(0, 2)}
        </Paragraph>
      </YStack>

      <YStack flex={1} gap="$1">
        <H3 numberOfLines={1}>{name}</H3>
        <Paragraph color="$color8" fontSize={14}>
          {ticker}
          {sector ? ` · ${sector}` : ''}
        </Paragraph>
      </YStack>
    </XStack>
  )
}
