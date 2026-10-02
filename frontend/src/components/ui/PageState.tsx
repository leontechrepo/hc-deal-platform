import { AlertTriangle } from 'lucide-react'
import { Button, EmptyState } from '@leontechrepo/leon-ui'
import { LoadingBlock } from './Skeleton/Skeleton'

/** Full-page loading placeholder. */
export function PageLoading({ label = 'Loading…', lines = 4 }: { label?: string; lines?: number }) {
  return <LoadingBlock label={label} lines={lines} />
}

/** Full-page error state with an optional retry. */
export function PageError({
  title = "Couldn't load this page",
  message = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      action={
        onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      {message}
    </EmptyState>
  )
}
