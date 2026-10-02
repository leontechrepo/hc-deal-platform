import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

export const PAGE_ACTIONS_SLOT = 'page-actions-slot'

const subscribe = () => () => {}
const getSlot = () => document.getElementById(PAGE_ACTIONS_SLOT)
const getServerSlot = () => null

/**
 * Portal page primary actions into the shell topbar. The slot is rendered by the
 * Topbar, which commits in the same pass as the page, so it is read through
 * `useSyncExternalStore`: null on the first render, then re-read after commit.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const slot = useSyncExternalStore(subscribe, getSlot, getServerSlot)
  if (!slot) return null
  return createPortal(children, slot)
}
