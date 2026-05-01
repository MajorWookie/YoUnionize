import { Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Right-aligned action (link, button). */
  action?: ReactNode
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <Group justify="space-between" align="flex-end" mb="md" wrap="nowrap" gap="sm">
      <Stack gap={4} style={{ minWidth: 0 }}>
        <Title order={3}>{title}</Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
      {action}
    </Group>
  )
}
