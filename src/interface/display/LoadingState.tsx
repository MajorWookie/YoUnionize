import { Paragraph, Spinner, YStack } from 'tamagui'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
      <Spinner size="large" color="$color9" />
      <Paragraph color="$color8">{message}</Paragraph>
    </YStack>
  )
}
