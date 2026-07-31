import styles from './Separator.module.css'

export function Separator({ className }: { className?: string }) {
  return <div className={[styles.separator, className].filter(Boolean).join(' ')} />
}
