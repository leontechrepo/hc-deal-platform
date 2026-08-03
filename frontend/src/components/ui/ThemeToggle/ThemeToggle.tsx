import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../../ThemeContext'
import styles from './ThemeToggle.module.css'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggle}
      title={label}
      aria-label={label}
    >
      <span className={styles.icon}>
        {isDark ? <Sun size={17} strokeWidth={2} aria-hidden="true" /> : <Moon size={17} strokeWidth={2} aria-hidden="true" />}
      </span>
    </button>
  )
}
