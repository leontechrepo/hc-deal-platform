import { NavLink } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useClerk } from '@clerk/react'
import {
  Kanban,
  ScrollText,
  BarChart3,
  Inbox as InboxIcon,
  Users,
  Landmark,
  Building2,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from 'lucide-react'
import { triggerScan } from '../../api/admin'
import { useNav } from '../../NavContext'
import { useToast } from '../Toast/Toast'
import { ThemeToggle } from '../ui/ThemeToggle/ThemeToggle'
import { NavIcon } from './NavIcon'
import leonLogo from '../../assets/leon-logo.png'
import styles from './NavBar.module.css'

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
          title="Pipeline"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <NavIcon icon={Kanban} />
          <span className={styles.navLabel}>Pipeline</span>
        </NavLink>

        <NavLink
          to="/logs"
          title="Logs"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <NavIcon icon={ScrollText} />
          <span className={styles.navLabel}>Logs</span>
        </NavLink>

        <NavLink
          to="/analytics"
          title="Analytics"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <NavIcon icon={BarChart3} />
          <span className={styles.navLabel}>Analytics</span>
        </NavLink>

        <NavLink
          to="/inbox"
          title="Inbox"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <NavIcon icon={InboxIcon} />
          <span className={styles.navLabel}>Inbox</span>
        </NavLink>

        <NavLink
          to="/sponsors"
          title="Sponsors"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <NavIcon icon={Users} />
          <span className={styles.navLabel}>Sponsors</span>
        </NavLink>

        <NavLink
          to="/funds"
          title="Funds"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <NavIcon icon={Landmark} />
          <span className={styles.navLabel}>Funds</span>
        </NavLink>

        <NavLink
          to="/portfolio"
          title="Portfolio"
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
        >
          <NavIcon icon={Building2} />
          <span className={styles.navLabel}>Portfolio</span>
        </NavLink>

        <div className={styles.divider} />

        <button
          className={styles.scanBtn}
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          title="Trigger email scan"
        >
          <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
          <span className={styles.scanBtnLabel}>
            {scanMutation.isPending ? 'Scanning…' : 'Scan Now'}
          </span>
        </button>

        <div style={{ flex: 1 }} />

        <div className={styles.divider} />

        <ThemeToggle collapsed={collapsed} />

        <button
          className={[styles.navItem, styles.signOutItem].join(' ')}
          onClick={() => signOut({ redirectUrl: '/' })}
          title="Sign out"
        >
          <NavIcon icon={LogOut} />
          <span className={styles.navLabel}>Sign Out</span>
        </button>
      </div>

      <button className={styles.collapseBtn} onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? <PanelLeftOpen size={18} strokeWidth={2} aria-hidden="true" /> : <PanelLeftClose size={18} strokeWidth={2} aria-hidden="true" />}
      </button>
    </nav>
  )
}
