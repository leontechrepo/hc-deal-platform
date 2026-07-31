import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../../ThemeContext'
import styles from './ThemeToggle.module.css'

interface ThemeToggleProps {
  collapsed?: boolean
}

export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={[styles.themeToggle, collapsed ? styles.collapsed : ''].filter(Boolean).join(' ')}
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className={styles.icon}>
        {isDark ? <Sun size={18} strokeWidth={2} aria-hidden="true" /> : <Moon size={18} strokeWidth={2} aria-hidden="true" />}
      </span>
      {!collapsed && <span className={styles.label}>{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}
