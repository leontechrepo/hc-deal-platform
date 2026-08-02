import type { ReactNode } from 'react'
import styles from './TableCard.module.css'

interface Props {
  title: string
  children: ReactNode
}

export function TableCard({ title, children }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>{title}</div>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
