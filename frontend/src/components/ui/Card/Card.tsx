import styles from './Card.module.css'

type Accent = 'gold' | 'navy' | 'green' | 'red'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  accent?: Accent
  hoverable?: boolean
}

export function Card({ accent, hoverable, className, ...rest }: Props) {
  return (
    <div
      className={[
        styles.card,
        accent ? styles[accent] : '',
        hoverable ? styles.hoverable : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}
