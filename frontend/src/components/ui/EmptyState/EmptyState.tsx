import styles from './EmptyState.module.css'

interface Props {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className={styles.empty}>
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.description}>{description}</div>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
