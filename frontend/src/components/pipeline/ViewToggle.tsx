import styles from './ViewToggle.module.css'

export type View = 'table' | 'kanban'

interface Props {
  view: View
  onChange: (view: View) => void
}

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div className={styles.toggle}>
      <button
        className={[styles.option, view === 'table' ? styles.active : ''].join(' ')}
        onClick={() => onChange('table')}
      >
        Table
      </button>
      <button
        className={[styles.option, view === 'kanban' ? styles.active : ''].join(' ')}
        onClick={() => onChange('kanban')}
      >
        Kanban
      </button>
    </div>
  )
}
