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
      <div className={styles.titleGroup}>
        {/* h1, not a div: this is the page's document heading now that PageHeader and
            the per-page <h1>s are gone, so heading navigation still works. */}
        <h1 className={styles.title}>{title}</h1>
        {sub && <div className={styles.sub}>{sub}</div>}
      </div>
      <div className={styles.spacer} />
      {children && <div className={styles.actions}>{children}</div>}
      <div className={styles.meta}>
        <div className={styles.pill}>As of {todayLabel()}</div>
        <ThemeToggle />
      </div>
    </header>
  )
}
