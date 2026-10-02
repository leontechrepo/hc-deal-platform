import type { ReactNode } from 'react'
import { Card, CardHeader, CardTitle } from '@leontechrepo/leon-ui'
import styles from './TableCard.module.css'

interface Props {
  title: string
  children: ReactNode
}

/** A titled card whose body is a (scrollable) table or grouped tables. */
export function TableCard({ title, children }: Props) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className={styles.body}>{children}</div>
    </Card>
  )
}
