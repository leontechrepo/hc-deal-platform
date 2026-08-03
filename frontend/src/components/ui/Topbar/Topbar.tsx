import type { ReactNode } from 'react'
import { ThemeToggle } from '../ThemeToggle/ThemeToggle'
import styles from './Topbar.module.css'

interface TopbarProps {
  title: string
  sub?: string
  /** Page-specific controls, rendered between the As-of pill and the theme toggle. */
  children?: ReactNode
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function Topbar({ title, sub, children }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div>
        <div className={styles.title}>{title}</div>
        {sub && <div className={styles.sub}>{sub}</div>}
      </div>
      <div className={styles.spacer} />
      {children && <div className={styles.actions}>{children}</div>}
      <div className={styles.pill}>As of {todayLabel()}</div>
      <ThemeToggle />
    </header>
  )
}
