import { Text } from '@mantine/core'
import type { ReactNode } from 'react'

interface EyebrowProps {
  children: ReactNode
}

export function Eyebrow({ children }: EyebrowProps) {
  return (
    <Text c="terracotta.7" fw={600} fz="xs" tt="uppercase" lts="0.04em">
      {children}
    </Text>
  )
}
