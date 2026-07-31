import styles from './Tag.module.css'

export type TagTone = 'default' | 'gold' | 'red'

interface Props {
  tone?: TagTone
  children: React.ReactNode
}

export function Tag({ tone = 'default', children }: Props) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>
}
