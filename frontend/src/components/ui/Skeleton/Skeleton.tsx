import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

/** Shimmering placeholder block used by loading states. */
export function Skeleton({ width, height = 14, className }: { width?: number | string; height?: number | string; className?: string }) {
  const style: CSSProperties = { width, height }
  return <div className={[styles.skeleton, className].filter(Boolean).join(' ')} style={style} aria-hidden="true" />
}

/** Page-level loading placeholder with an accessible status label. */
export function LoadingBlock({ label = 'Loading…', lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div className={styles.block} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={14} width={`${90 - i * 12}%`} />
      ))}
      <span className={styles.srOnly}>{label}</span>
    </div>
  )
}
