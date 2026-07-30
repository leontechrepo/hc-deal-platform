import { NavLink } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClerk } from '@clerk/react'
import { triggerScan } from '../../api/admin'
import { useNav } from '../../NavContext'
import { useToast } from '../Toast/Toast'
import leonLogo from '../../assets/leon-logo.png'
import styles from './NavBar.module.css'

function IconPipeline() {
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

function IconAnalytics() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="9" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.8"/>
      <rect x="6.5" y="5" width="3" height="9" rx="0.5" fill="currentColor" opacity="0.8"/>
      <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" opacity="0.8"/>
    </svg>
  )
}

function IconSponsors() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="11.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.5" opacity="0.7"/>
      <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10.5 10.5c1.8.2 3 1.4 3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
    </svg>
  )
}

function IconFunds() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="4" rx="5.5" ry="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2.5 4v4c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2.5 8v4c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V8" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function IconPortfolio() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2.5" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 7.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconInbox() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 8.5V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M1.5 8.5h4l1 2h3l1-2h4v3a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
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
        <div className={styles.logoMark}>
          <img src={leonLogo} alt="Leon" className={styles.logoImg} />
        </div>
        {!collapsed && (
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>LHP Private Credit</span>
            <span className={styles.logoSub}>Deal Pipeline</span>
          </div>
        )}
      </div>

      <div className={styles.navItems}>
        <NavLink
          to="/pipeline"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconPipeline /></span>
          <span className={styles.navLabel}>Pipeline</span>
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

        <NavLink
          to="/analytics"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconAnalytics /></span>
          <span className={styles.navLabel}>Analytics</span>
        </NavLink>

        <NavLink
          to="/inbox"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconInbox /></span>
          <span className={styles.navLabel}>Inbox</span>
        </NavLink>

        <NavLink
          to="/sponsors"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconSponsors /></span>
          <span className={styles.navLabel}>Sponsors</span>
        </NavLink>

        <NavLink
          to="/funds"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconFunds /></span>
          <span className={styles.navLabel}>Funds</span>
        </NavLink>

        <NavLink
          to="/portfolio"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <span className={styles.navIcon}><IconPortfolio /></span>
          <span className={styles.navLabel}>Portfolio</span>
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
