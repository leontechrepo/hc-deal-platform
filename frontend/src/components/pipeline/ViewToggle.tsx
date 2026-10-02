import { Columns3, Table2 } from 'lucide-react'
import styles from './ViewToggle.module.css'

export type View = 'table' | 'kanban'

interface Props {
  view: View
  onChange: (view: View) => void
}

const OPTIONS = [
  ['table', 'Table', Table2],
  ['kanban', 'Board', Columns3],
] as const

/** Segmented Table / Board switch. */
export function ViewToggle({ view, onChange }: Props) {
  return (
    <div className={styles.toggle} role="group" aria-label="Pipeline view">
      {OPTIONS.map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          className={[styles.option, view === key ? styles.active : ''].join(' ')}
          aria-pressed={view === key}
          onClick={() => onChange(key)}
        >
          <Icon size={13} strokeWidth={2.05} />
          {label}
        </button>
      ))}
    </div>
  )
}
