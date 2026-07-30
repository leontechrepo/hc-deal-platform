import { usePatchDeal } from '../../hooks/useDeals'
import { InlineEditText } from '../ui/InlineEditText/InlineEditText'

interface Props {
  dealId: number
  field: string
  value: string | null
  multiline?: boolean
}

export function InlineEdit({ dealId, field, value, multiline = false }: Props) {
  const { mutateAsync } = usePatchDeal()

  return (
    <InlineEditText
      value={value}
      multiline={multiline}
      onSave={(v) => mutateAsync({ dealId, field, value: v })}
    />
  )
}
