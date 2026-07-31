import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const THEME_KEY = 'theme'

interface ThemeContextValue {
  theme: 'light' | 'dark'
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') || localStorage.getItem(THEME_KEY) === 'dark'
      ? 'dark'
      : 'light'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
