import { Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { Eyebrow } from './Eyebrow'

interface PageHeaderProps {
  /** Small uppercase label rendered above the title (e.g. "MY PAY"). */
  eyebrow?: ReactNode
  title: ReactNode
  /** Optional muted lead paragraph. Wrapped to a 65ch measure for readability. */
  description?: ReactNode
  /** Right-aligned actions (buttons, link). */
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" mb="xl" wrap="nowrap" gap="md">
      <Stack gap="xs" style={{ minWidth: 0, flex: 1 }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Title order={1}>{title}</Title>
        {description ? (
          <Text c="dimmed" size="md" style={{ maxWidth: '65ch' }}>
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions ? <Group gap="sm">{actions}</Group> : null}
    </Group>
  )
}
