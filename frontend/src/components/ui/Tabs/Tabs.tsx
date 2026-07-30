import { NavLink } from 'react-router-dom'
import styles from './Tabs.module.css'

interface TabItem {
  key: string
  label: string
  /** If provided, renders as a routed NavLink tab; otherwise a local-state tab. */
  to?: string
}

interface Props {
  items: TabItem[]
  activeKey?: string
  onChange?: (key: string) => void
}

export function Tabs({ items, activeKey, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {items.map(item =>
        item.to ? (
          <NavLink
            key={item.key}
            to={item.to}
            className={({ isActive }) => [styles.tab, isActive ? styles.active : ''].join(' ')}
          >
            {item.label}
          </NavLink>
        ) : (
          <button
            key={item.key}
            className={[styles.tab, activeKey === item.key ? styles.active : ''].join(' ')}
            onClick={() => onChange?.(item.key)}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
