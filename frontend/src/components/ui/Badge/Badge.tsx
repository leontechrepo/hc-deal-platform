import styles from './Badge.module.css'

export type BadgeTone = 'navy' | 'gold' | 'green' | 'red' | 'blue' | 'purple' | 'yellow' | 'gray' | 'orange'

interface Props {
  tone?: BadgeTone
  children: React.ReactNode
}

export function Badge({ tone = 'gray', children }: Props) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
