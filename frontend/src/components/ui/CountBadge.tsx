import { Badge } from '@leontechrepo/leon-ui'

import { useBadgeTone } from '../../domain/badgeTones'

/** The small muted count pill next to a table/section title, e.g. "Deals 42". */
export function CountBadge({ count }: { count: number }) {
  const tone = useBadgeTone('muted')
  return <Badge {...tone}>{count}</Badge>
}
