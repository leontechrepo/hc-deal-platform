import type { ReactNode } from 'react'
import styles from './RowActions.module.css'

/** Right-aligned cluster of row buttons (Edit / Remove). */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className={styles.rowActions}>{children}</div>
}
