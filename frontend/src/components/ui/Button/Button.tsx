import {
  Button as LeonButton,
  type ButtonProps as LeonButtonProps,
} from '@leontechrepo/leon-ui'
import type { ButtonHTMLAttributes } from 'react'

type HcVariant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger'
type HcSize = 'sm' | 'md'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: HcVariant
  size?: HcSize
}

const VARIANT: Record<HcVariant, NonNullable<LeonButtonProps['variant']>> = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  gold: 'default',
  danger: 'destructive',
}

/** Compatibility shim: HC call sites keep primary/gold/danger; leon-ui underneath. */
export function Button({ variant = 'primary', size = 'md', className, ...rest }: Props) {
  return (
    <LeonButton
      variant={VARIANT[variant]}
      size={size === 'sm' ? 'sm' : 'default'}
      className={className}
      {...rest}
    />
  )
}
