import { SimpleGrid, type SimpleGridProps } from '@mantine/core'
import type { ReactNode } from 'react'

interface StatGridProps {
  children: ReactNode
  /** Override the default responsive column counts. */
  cols?: SimpleGridProps['cols']
  spacing?: SimpleGridProps['spacing']
}

export function StatGrid({ children, cols, spacing = 'md' }: StatGridProps) {
  return (
    <SimpleGrid cols={cols ?? { base: 1, sm: 2, lg: 4 }} spacing={spacing}>
      {children}
    </SimpleGrid>
  )
}
