import { createContext, useCallback, useContext, useState } from 'react'

const COLLAPSED_KEY = 'nav_collapsed'

interface NavContextValue {
  collapsed: boolean
  toggle: () => void
}

const NavContext = createContext<NavContextValue>({ collapsed: false, toggle: () => {} })

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true')

  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  return <NavContext.Provider value={{ collapsed, toggle }}>{children}</NavContext.Provider>
}

export function useNav() {
  return useContext(NavContext)
}
