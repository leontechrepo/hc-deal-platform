import type { ReactNode } from 'react'
import styles from './PipelineStageGroup.module.css'

interface Props {
  label: string
  count: number
  totalM?: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function PipelineStageGroup({ label, count, totalM, open, onToggle, children }: Props) {
  const dealWord = count === 1 ? 'deal' : 'deals'
  const summary = totalM && totalM > 0 ? `${count} ${dealWord} · $${totalM.toFixed(1)}M ask` : `${count} ${dealWord}`

  return (
    <div className={styles.group}>
      <button type="button" className={styles.header} onClick={onToggle} aria-expanded={open}>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▸</span>
        <span className={styles.label}>{label}</span>
        <span className={styles.summary}>{summary}</span>
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </div>
  )
}
