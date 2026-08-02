import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import { useCreateDealNote, useDealNotes, useDeleteDealNote, useUpdateDealNote } from '../../../hooks/useDealDetail'
import { useCurrentActor } from '../../../hooks/useCurrentActor'
import { Button } from '../../../components/ui/Button/Button'
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState'
import { InlineEditText } from '../../../components/ui/InlineEditText/InlineEditText'
import { useToast } from '../../../components/Toast/Toast'
import formStyles from '../../../components/shared/Form.module.css'
import type { Deal } from '../../../types'
import styles from './NotesTab.module.css'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function NotesTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()
  const { data: notes = [], isLoading, isError } = useDealNotes(deal.id)
  const createNote = useCreateDealNote()
  const updateNote = useUpdateDealNote(deal.id)
  const deleteNote = useDeleteDealNote(deal.id)
  const actor = useCurrentActor()
  const { showToast } = useToast()
  const [draft, setDraft] = useState('')

  async function addNote() {
    const body = draft.trim()
    if (!body) return
    try {
      await createNote.mutateAsync({ dealId: deal.id, body: { body, author: actor } })
      setDraft('')
      showToast('Note added')
    } catch {
      showToast('Failed to add note', true)
    }
  }

  async function removeNote(noteId: number) {
    try {
      await deleteNote.mutateAsync(noteId)
      showToast('Note deleted')
    } catch {
      showToast('Failed to delete note', true)
    }
  }

  if (isLoading) return <div className={styles.state}>Loading notes…</div>
  if (isError) return <div className={styles.state}>Failed to load notes.</div>

  return (
    <div className={styles.tab}>
      <div className={styles.addNote}>
        <textarea
          className={formStyles.textarea}
          placeholder="Add a note…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <Button variant="secondary" size="sm" onClick={addNote} disabled={!draft.trim() || createNote.isPending}>
          Add Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState title="No notes yet" description="Add a note to keep working context on this deal." />
      ) : (
        <div className={styles.list}>
          {notes.map(note => (
            <div key={note.id} className={styles.note}>
              <div className={styles.noteHeader}>
                <span className={styles.noteAuthor}>{note.author ?? 'user'}</span>
                <span className={styles.noteDate}>{fmtDate(note.created_at)}</span>
                <button className={styles.deleteBtn} onClick={() => removeNote(note.id)} title="Delete note">×</button>
              </div>
              <InlineEditText
                value={note.body}
                onSave={value => updateNote.mutateAsync({ noteId: note.id, body: value ?? '' })}
                multiline
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
