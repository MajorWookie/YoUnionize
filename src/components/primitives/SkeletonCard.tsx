import { Card, Skeleton, Stack } from '@mantine/core'

interface SkeletonCardProps {
  /** Number of body lines below the heading skeleton. Default 3. */
  rows?: number
  /** When true, prepends a media-sized block (for card+image layouts). */
  withMedia?: boolean
}

export function SkeletonCard({ rows = 3, withMedia = false }: SkeletonCardProps) {
  return (
    <Card>
      <Stack gap="sm">
        {withMedia ? <Skeleton height={120} mb="xs" /> : null}
        <Skeleton height={20} width="60%" />
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            height={14}
            width={i === rows - 1 ? '70%' : '100%'}
          />
        ))}
      </Stack>
    </Card>
  )
}
