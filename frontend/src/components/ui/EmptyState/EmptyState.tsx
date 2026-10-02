import { EmptyState as LeonEmptyState } from '@leontechrepo/leon-ui'
import type { ComponentType, ReactNode } from 'react'

interface Props {
  title?: string
  description?: string
  children?: ReactNode
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  action?: ReactNode
  className?: string
}

/** HC used `description`; leon-ui uses `children` for body copy. */
export function EmptyState({ title, description, children, ...rest }: Props) {
  return (
    <LeonEmptyState title={title} {...rest}>
      {children ?? description}
    </LeonEmptyState>
  )
}
