import styles from './PageHeader.module.css'

interface Props {
  eyebrow?: string
  title: string
}

export function PageHeader({ eyebrow = 'LHP Private Credit — Deal Platform', title }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1 className={styles.title}>{title}</h1>
    </header>
  )
}
