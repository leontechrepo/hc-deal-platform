import { useClerk, useUser } from '@clerk/react'
import { Sidebar as DsSidebar, type SidebarNavEntry } from '@leontechrepo/leon-ui'
import {
  BarChart3,
  Building,
  Building2,
  Columns3,
  FileText,
  Inbox,
  Landmark,
  MessageSquare,
  ScrollText,
  Users,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import leonLogo from '../../assets/leon-logo.png'
import { usePendingCount } from '../../hooks/useInbox'
import { useCurrentActor } from '../../hooks/useCurrentActor'

const NAV: SidebarNavEntry[] = [
  { section: 'Pipeline' },
  { path: '/pipeline', label: 'Pipeline', icon: Columns3 },
  { path: '/executive-summary', label: 'Executive Summary', icon: FileText },
  { section: 'Deal Management' },
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/sponsors', label: 'Sponsors', icon: Users },
  { path: '/companies', label: 'Companies', icon: Building },
  { path: '/funds', label: 'Funds', icon: Landmark },
  { path: '/portfolio', label: 'Portfolio', icon: Building2 },
  { section: 'Tools' },
  { path: '/chat', label: 'Credit Co-Pilot', icon: MessageSquare },
  { path: '/logs', label: 'Logs', icon: ScrollText },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
]

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const pending = usePendingCount()
  const { signOut } = useClerk()
  const { user } = useUser()
  const { pathname } = useLocation()
  const actor = useCurrentActor()

  const clerkName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : ''
  const label = clerkName || user?.username || actor || 'Account'

  const items = NAV.map((entry) =>
    'path' in entry && entry.path === '/inbox'
      ? { ...entry, badge: pending > 0 ? pending : null }
      : entry,
  )

  return (
    <DsSidebar
      items={items}
      isActive={(path) => pathname === path || pathname.startsWith(`${path}/`)}
      linkComponent={Link}
      homeHref="/pipeline"
      logoSrc={leonLogo}
      title="Corporate Credit"
      storageKey="hc-nav-collapsed"
      user={{ name: label, imageUrl: user?.imageUrl, initials: initialsFor(label) }}
      onSignOut={() => signOut({ redirectUrl: '/' })}
    />
  )
}
