import styles from './ThinkingIndicator.module.css'

export function ThinkingIndicator() {
  return (
    <div className={styles.row}>
      <div className={styles.status}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  )
}
