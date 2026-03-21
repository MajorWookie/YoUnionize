import type { ReactNode } from 'react'
import { Button, Paragraph, YStack } from 'tamagui'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <YStack flex={1} items="center" justify="center" gap="$3" p="$6">
      {icon && (
        <YStack opacity={0.4} mb="$2">
          {icon}
        </YStack>
      )}
      <Paragraph fontSize={18} fontWeight="600" color="$color12">
        {title}
      </Paragraph>
      <Paragraph color="$color8" text="center" maxW={320}>
        {description}
      </Paragraph>
      {actionLabel && onAction && (
        <Button size="$3" theme="accent" onPress={onAction} mt="$2">
          {actionLabel}
        </Button>
      )}
    </YStack>
  )
}
