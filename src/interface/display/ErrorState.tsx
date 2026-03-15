import { Button, Paragraph, YStack } from 'tamagui'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
      <Paragraph fontSize={40}>!</Paragraph>
      <Paragraph fontSize={18} fontWeight="600" color="$color12">
        {title}
      </Paragraph>
      <Paragraph color="$color8" textAlign="center" maxWidth={320}>
        {message}
      </Paragraph>
      {onRetry && (
        <Button size="$3" theme="accent" onPress={onRetry} marginTop="$2">
          Try Again
        </Button>
      )}
    </YStack>
  )
}
