import type { CSSProperties } from 'react'

interface Props {
  size?: number
  className?: string
  style?: CSSProperties
}

export function AiStarIcon({ size = 21, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M12 1.5 14.2 9.3 22 11.5 14.2 13.7 12 21.5 9.8 13.7 2 11.5 9.8 9.3 12 1.5Z" />
    </svg>
  )
}
