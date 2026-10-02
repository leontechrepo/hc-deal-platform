import type { ComponentType, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardActions, CardHeader, CardTitle, EmptyState } from '@leontechrepo/leon-ui'
import { LoadingBlock } from '../ui/Skeleton/Skeleton'
import styles from './DataSection.module.css'

interface Props {
  title: ReactNode
  /** Right-aligned header actions (buttons). */
  actions?: ReactNode
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
  noun?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  children: ReactNode
}

/**
 * A titled card whose body is a table or list with the three non-happy states
 * (loading skeleton, error, empty) handled uniformly.
 */
export function DataSection({
  title,
  actions,
  isLoading,
  isError,
  isEmpty,
  noun = 'items',
  emptyTitle,
  emptyDescription,
  emptyIcon,
  children,
}: Props) {
  return (
    <Card>
      <CardHeader className={styles.header}>
        <CardTitle>{title}</CardTitle>
        {actions ? <CardActions>{actions}</CardActions> : null}
      </CardHeader>
      {isLoading ? (
        <LoadingBlock label={`Loading ${noun}…`} />
      ) : isError ? (
        <EmptyState icon={AlertTriangle} title={`Couldn't load ${noun}`}>
          Check your connection and try again.
        </EmptyState>
      ) : isEmpty ? (
        <EmptyState icon={emptyIcon} title={emptyTitle}>
          {emptyDescription}
        </EmptyState>
      ) : (
        children
      )}
    </Card>
  )
}
