import { Group, Text } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface TrustStripProps {
  children: ReactNode
}

/**
 * Small inline reassurance: lock icon + dimmed microcopy. Used at moments
 * where the user is being asked for sensitive info (auth, onboarding,
 * profile edits) — the plain-language "what we'll do with this" answer.
 */
export function TrustStrip({ children }: TrustStripProps) {
  return (
    <Group gap="xs" align="center" wrap="nowrap" c="dimmed">
      <IconLock size={14} stroke={1.8} />
      <Text size="xs" c="dimmed">
        {children}
      </Text>
    </Group>
  )
}
