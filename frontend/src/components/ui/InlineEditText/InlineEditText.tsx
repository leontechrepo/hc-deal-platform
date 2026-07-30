import { useRef, useState } from 'react'
import { useToast } from '../../Toast/Toast'
import styles from './InlineEditText.module.css'

interface Props {
  value: string | null
  onSave: (value: string | null) => Promise<unknown>
  multiline?: boolean
  placeholder?: string
}

export function InlineEditText({ value, onSave, multiline = false, placeholder = '—' }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
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
      await onSave(trimmed)
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

  if (!editing) {
    return (
      <span className={styles.display} onClick={startEdit} title="Click to edit">
        {value || <span className={styles.placeholder}>{placeholder}</span>}
      </span>
    )
  }

  const commonProps = {
    ref: inputRef as never,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: save,
    onKeyDown,
    className: styles.input,
  }

  return multiline ? (
    <textarea {...commonProps} rows={3} />
  ) : (
    <input type="text" {...commonProps} />
  )
}
