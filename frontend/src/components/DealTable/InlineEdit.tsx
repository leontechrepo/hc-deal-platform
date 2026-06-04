import { useRef, useState } from 'react'
import { usePatchDeal } from '../../hooks/useDeals'
import { useToast } from '../Toast/Toast'

interface Props {
  dealId: number
  field: string
  value: string | null
  multiline?: boolean
}

export function InlineEdit({ dealId, field, value, multiline = false }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const { mutateAsync } = usePatchDeal()
  const { showToast } = useToast()
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  function startEdit() {
    setDraft(value ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function save() {
    setEditing(false)
    const trimmed = draft.trim() || null
    if (trimmed === (value ?? null)) return
    try {
      await mutateAsync({ dealId, field, value: trimmed })
      showToast('Saved')
    } catch {
      showToast('Save failed', true)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      save()
    }
    if (e.key === 'Escape') {
      setEditing(false)
      setDraft(value ?? '')
    }
  }

  const displayStyle: React.CSSProperties = {
    cursor: 'pointer',
    minHeight: '1.2em',
    borderRadius: 3,
    padding: '2px 4px',
    margin: '-2px -4px',
    transition: 'background 0.1s',
  }

  if (!editing) {
    return (
      <span
        style={displayStyle}
        onClick={startEdit}
        title="Click to edit"
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-100)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {value || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>—</span>}
      </span>
    )
  }

  const commonProps = {
    ref: inputRef as never,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: save,
    onKeyDown,
    style: {
      width: '100%',
      border: '1px solid var(--gold)',
      borderRadius: 3,
      padding: '3px 6px',
      fontSize: 13,
      fontFamily: 'inherit',
      background: 'var(--white)',
      outline: 'none',
      resize: 'vertical' as const,
    } as React.CSSProperties,
  }

  return multiline ? (
    <textarea {...commonProps} rows={3} />
  ) : (
    <input type="text" {...commonProps} />
  )
}
