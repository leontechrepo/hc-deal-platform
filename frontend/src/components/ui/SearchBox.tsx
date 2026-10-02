import { Search } from 'lucide-react'
import { Input } from '@leontechrepo/leon-ui'
import styles from './SearchBox.module.css'

/** Search field with a leading icon (leon-ui `Input`). */
export function SearchBox({
  value,
  onChange,
  placeholder = 'Search…',
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
}) {
  return (
    <div className={[styles.search, className].filter(Boolean).join(' ')}>
      <Search size={14} className={styles.icon} aria-hidden="true" />
      <Input
        type="search"
        className={styles.input}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
