import type { ReactNode } from 'react'
import styles from './NavBar.module.css'

interface Props {
  title: string
  children: ReactNode
}

export function NavSection({ title, children }: Props) {
  return (
    <div className={styles.navSection}>
      <div className={styles.navSectionLabel}>{title}</div>
      {children}
    </div>
  )
}
