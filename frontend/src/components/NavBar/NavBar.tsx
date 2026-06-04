import { NavLink } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClerk } from '@clerk/react'
import { triggerScan } from '../../api/admin'
import { useNav } from '../../NavContext'
import { useToast } from '../Toast/Toast'
import styles from './NavBar.module.css'

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.8"/>
    </svg>
  )
}

function IconLogs() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="2" y="7" width="9" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="2" y="11" width="11" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  )
}

function IconScan() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5A5.5 5.5 0 1 1 1.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M1.5 3.5V7H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconSignOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 11l3-3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}


export function NavBar() {
  const { collapsed, toggle } = useNav()
  const { showToast } = useToast()
  const { signOut } = useClerk()

  const qc = useQueryClient()

  const scanMutation = useMutation({
    mutationFn: triggerScan,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      qc.invalidateQueries({ queryKey: ['logs'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      showToast(`Scan complete — ${data.emails_processed} emails processed`)
    },
    onError: () => showToast('Scan failed', true),
  })

  const cls = [styles.nav, collapsed ? styles.collapsed : styles.expanded].join(' ')

  return (
    <nav className={cls}>
      <div className={styles.logo}>
        {collapsed ? (
          <div className={styles.logoIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 5v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        ) : (
          <>
            <span className={styles.logoTitle}>LHP Private Credit</span>
            <span className={styles.logoSub}>Deal Pipeline</span>
          </>
        )}
      </div>

      <div className={styles.navItems}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconDashboard /></span>
          <span className={styles.navLabel}>Dashboard</span>
        </NavLink>

        <NavLink
          to="/logs"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconLogs /></span>
          <span className={styles.navLabel}>Logs</span>
        </NavLink>

        <div className={styles.divider} />

        <button
          className={styles.scanBtn}
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          title="Trigger email scan"
        >
          <IconScan />
          <span className={styles.scanBtnLabel}>
            {scanMutation.isPending ? 'Scanning…' : 'Scan Now'}
          </span>
        </button>

        <div style={{ flex: 1 }} />

        <div className={styles.divider} />

        <button
          className={[styles.navItem, styles.signOutItem].join(' ')}
          onClick={() => signOut({ redirectUrl: '/' })}
          title="Sign out"
        >
          <span className={styles.navIcon}><IconSignOut /></span>
          <span className={styles.navLabel}>Sign Out</span>
        </button>
      </div>

      <button className={styles.collapseBtn} onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
      </button>
    </nav>
  )
}
