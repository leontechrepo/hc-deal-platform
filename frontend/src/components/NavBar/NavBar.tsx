import { NavLink } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { triggerScan } from '../../api/admin'
import { useNav } from '../../NavContext'
import { useInbox } from '../../hooks/useInbox'
import { useToast } from '../Toast/Toast'
import { NavIcon } from './NavIcon'
import { NavSection } from './NavSection'
import { UserFooter } from './UserFooter'
import {
  Kanban,
  FileText,
  ScrollText,
  BarChart3,
  InboxIcon,
  Users,
  Landmark,
  Building2,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  AiStarIcon,
} from './icons'
import leonLogo from '../../assets/leon-logo.png'
import styles from './NavBar.module.css'

export function NavBar() {
  const { collapsed, toggle } = useNav()
  const { showToast } = useToast()
  const { data: inboxItems = [] } = useInbox()

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
  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    [styles.navItem, isActive ? styles.active : ''].join(' ')

  return (
    <nav className={cls}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <img src={leonLogo} alt="Leon" className={styles.logoImg} />
        </div>
        {!collapsed && (
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>Corporate Credit</span>
            <span className={styles.logoSub}>Deal Pipeline</span>
          </div>
        )}
      </div>

      <div className={styles.navItems}>
        <NavSection title="Pipeline">
          <NavLink to="/pipeline" title="Pipeline" className={navItemClass}>
            <NavIcon icon={Kanban} />
            <span className={styles.navLabel}>Pipeline</span>
          </NavLink>

          <NavLink to="/executive-summary" title="Executive Summary" className={navItemClass}>
            <NavIcon icon={FileText} />
            <span className={styles.navLabel}>Executive Summary</span>
          </NavLink>
        </NavSection>

        <NavSection title="Deal Management">
          <NavLink to="/inbox" title="Inbox" className={navItemClass}>
            <NavIcon icon={InboxIcon} />
            <span className={styles.navLabel}>Inbox</span>
            {inboxItems.length > 0 && <span className={styles.navBadge}>{inboxItems.length}</span>}
          </NavLink>

          <NavLink to="/sponsors" title="Sponsors" className={navItemClass}>
            <NavIcon icon={Users} />
            <span className={styles.navLabel}>Sponsors</span>
          </NavLink>

          <NavLink to="/funds" title="Funds" className={navItemClass}>
            <NavIcon icon={Landmark} />
            <span className={styles.navLabel}>Funds</span>
          </NavLink>

          <NavLink to="/portfolio" title="Portfolio" className={navItemClass}>
            <NavIcon icon={Building2} />
            <span className={styles.navLabel}>Portfolio</span>
          </NavLink>
        </NavSection>

        <NavSection title="Tools">
          <NavLink to="/chat" title="Credit Co-Pilot" className={navItemClass}>
            <span className={styles.navIcon}>
              <AiStarIcon size={21} />
            </span>
            <span className={styles.navLabel}>Credit Co-Pilot</span>
          </NavLink>

          <NavLink to="/logs" title="Logs" className={navItemClass}>
            <NavIcon icon={ScrollText} />
            <span className={styles.navLabel}>Logs</span>
          </NavLink>

          <NavLink to="/analytics" title="Analytics" className={navItemClass}>
            <NavIcon icon={BarChart3} />
            <span className={styles.navLabel}>Analytics</span>
          </NavLink>
        </NavSection>

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
      </div>

      <UserFooter />

      <button className={styles.collapseBtn} onClick={toggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? <PanelLeftOpen size={18} strokeWidth={2} aria-hidden="true" /> : <PanelLeftClose size={18} strokeWidth={2} aria-hidden="true" />}
      </button>
    </nav>
  )
}
