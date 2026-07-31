import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const THEME_KEY = 'theme'

function readStoredTheme(): 'light' | 'dark' | null {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : localStorage.getItem(THEME_KEY) === 'light' ? 'light' : null
  } catch {
    return null
  }
}

function writeStoredTheme(theme: 'light' | 'dark') {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // storage blocked (sandboxed context, privacy mode, etc.) — theme still applies for this session
  }
}

interface ThemeContextValue {
  theme: 'light' | 'dark'
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') || readStoredTheme() === 'dark' ? 'dark' : 'light'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    writeStoredTheme(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
