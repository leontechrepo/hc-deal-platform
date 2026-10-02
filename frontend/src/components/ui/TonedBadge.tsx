import { Badge } from '@leontechrepo/leon-ui'
import type { ReactNode } from 'react'

import { useBadgeTone, type BadgeTone } from '../../domain/badgeTones'

/**
 * A leon-ui `Badge` coloured by one of the fixed tones. `Badge` forwards no DOM
 * attributes beyond `className`/`style`, so a tooltip needs an outer element.
 */
export function TonedBadge({
  tone,
  children,
  className,
  title,
}: {
  /** `gray` is accepted as an alias of `muted` for neutral states. */
  tone: BadgeTone | 'gray'
  children: ReactNode
  className?: string
  title?: string
}) {
  const props = useBadgeTone(tone === 'gray' ? 'muted' : tone)
  const badge = (
    <Badge {...props} className={className}>
      {children}
    </Badge>
  )
  return title ? <span title={title}>{badge}</span> : badge
}
