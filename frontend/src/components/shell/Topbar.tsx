import { Topbar as DsTopbar } from '@leontechrepo/leon-ui'
import { useMatches } from 'react-router-dom'

import { PAGE_ACTIONS_SLOT } from './PageActions'

export interface Handle {
  title?: string
  sub?: string
  pinned?: true
}

export function Topbar() {
  const matches = useMatches()
  const handle = [...matches].reverse().find((m) => (m.handle as Handle | undefined)?.title)
  const { title, sub } = ((handle?.handle as Handle | undefined) ?? {}) as Handle

  return (
    <DsTopbar title={title ?? 'Corporate Credit'} sub={sub}>
      <div id={PAGE_ACTIONS_SLOT} className="topbar-actions" />
    </DsTopbar>
  )
}
