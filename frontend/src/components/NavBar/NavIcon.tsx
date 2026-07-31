import type { LucideIcon } from 'lucide-react'
import styles from './NavBar.module.css'

interface NavIconProps {
  icon: LucideIcon
  size?: number
}

export function NavIcon({ icon: Icon, size = 21 }: NavIconProps) {
  return (
    <span className={styles.navIcon}>
      <Icon size={size} strokeWidth={2.05} aria-hidden="true" />
    </span>
  )
}
