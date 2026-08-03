import type { ReactNode } from 'react'
import { Topbar } from '../Topbar/Topbar'
import shell from '../../AppShell/AppShell.module.css'

interface PageShellProps {
  title: string
  sub?: string
  /** Page-specific controls rendered in the topbar. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * Every page's frame: the floating topbar plus the glass page panel that owns
 * scrolling. Mirrors Reip, where each page renders its own Topbar above
 * `.page-content` rather than the layout doing it — which is what lets a page
 * like Deal Detail title itself from loaded data.
 */
export function PageShell({ title, sub, actions, children }: PageShellProps) {
  return (
    <>
      <Topbar title={title} sub={sub}>{actions}</Topbar>
      <div className={shell.pageContent}>{children}</div>
    </>
  )
}
