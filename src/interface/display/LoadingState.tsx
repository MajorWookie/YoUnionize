import { Paragraph, Spinner, YStack } from 'tamagui'

interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <YStack flex={1} items="center" justify="center" gap="$3" p="$6">
      <Spinner size="large" color="$color9" />
      <Paragraph color="$color8">{message}</Paragraph>
    </YStack>
  )
}
