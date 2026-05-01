import { Card, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Optional leading icon (Tabler icon, illustration, etc). */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card style={{ borderStyle: 'dashed' }}>
      <Stack align="center" gap="md" py="xl">
        {icon ? <div>{icon}</div> : null}
        <Stack gap={4} align="center">
          <Title order={4}>{title}</Title>
          {description ? (
            <Text c="dimmed" ta="center" size="sm" style={{ maxWidth: '40ch' }}>
              {description}
            </Text>
          ) : null}
        </Stack>
        {action}
      </Stack>
    </Card>
  )
}
