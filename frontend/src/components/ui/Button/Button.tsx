import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger'
type Size = 'sm' | 'md'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'primary', size = 'md', className, ...rest }: Props) {
  return (
    <button
      className={[styles.btn, styles[variant], size === 'sm' ? styles.sm : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}
