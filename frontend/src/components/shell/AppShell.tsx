import { AppShell as DsAppShell } from '@leontechrepo/leon-ui'
import { Outlet, useMatches } from 'react-router-dom'

import type { Handle } from './Topbar'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const matches = useMatches()
  const pinned = matches.some((m) => (m.handle as Handle | undefined)?.pinned)

  return (
    <DsAppShell sidebar={<Sidebar />}>
      <Topbar />
      <main className={pinned ? 'page-content is-pinned' : 'page-content'}>
        <Outlet />
      </main>
    </DsAppShell>
  )
}
