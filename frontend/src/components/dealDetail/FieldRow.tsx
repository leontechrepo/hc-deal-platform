import type { ReactNode } from 'react'
import styles from './FieldRow.module.css'

/** Label / value row used by the editable deal sections. */
export function FieldRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.value}>{children}</div>
    </div>
  )
}

/** Muted, non-editable value text. */
export function ReadOnlyValue({ children }: { children: ReactNode }) {
  return <span className={styles.readOnly}>{children}</span>
}

/** Small hint under a field value (e.g. a live formula result). */
export function FieldHint({ children }: { children: ReactNode }) {
  return <span className={styles.hint}>{children}</span>
}
