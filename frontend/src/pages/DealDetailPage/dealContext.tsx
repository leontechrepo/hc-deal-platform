import { createContext, useContext, type ReactNode } from 'react'
import type { Deal } from '../../types'

const DealCtx = createContext<{ deal: Deal } | null>(null)

export function DealProvider({ deal, children }: { deal: Deal; children: ReactNode }) {
  return <DealCtx.Provider value={{ deal }}>{children}</DealCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDealContext() {
  const ctx = useContext(DealCtx)
  if (!ctx) throw new Error('useDealContext requires DealProvider')
  return ctx
}
