import { useDealContext } from '../dealContext'
import { useState } from 'react'
import { StickyNote, Trash2 } from 'lucide-react'
import { Button, Card } from '@leontechrepo/leon-ui'
import { useCreateDealNote, useDealNotes, useDeleteDealNote, useUpdateDealNote } from '../../../hooks/useDealDetail'
import { useCurrentActor } from '../../../hooks/useCurrentActor'
import { DataSection } from '../../../components/dealDetail/DataSection'
import { InlineEditText } from '../../../components/ui/InlineEditText/InlineEditText'
import { TextareaInput } from '../../../components/ui/Form/Form'
import { useToast } from '../../../components/Toast/Toast'
import styles from './NotesTab.module.css'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function NotesTab() {
  const { deal } = useDealContext()
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

  return (
    <div className="detail-cards">
      <Card className={styles.addNote}>
        <TextareaInput
          placeholder="Add a note…"
          aria-label="New note"
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <Button variant="secondary" size="sm" onClick={addNote} disabled={!draft.trim() || createNote.isPending}>
          Add Note
        </Button>
      </Card>

      <DataSection
        title="Notes"
        noun="notes"
        isLoading={isLoading}
        isError={isError}
        isEmpty={notes.length === 0}
        emptyIcon={StickyNote}
        emptyTitle="No notes yet"
        emptyDescription="Add a note to keep working context on this deal."
      >
        <div className={styles.list}>
          {notes.map(note => (
            <div key={note.id} className={styles.note}>
              <div className={styles.noteHeader}>
                <span className={styles.noteAuthor}>{note.author ?? 'user'}</span>
                <span className={styles.noteDate}>{fmtDate(note.created_at)}</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => removeNote(note.id)}
                  title="Delete note"
                  aria-label="Delete note"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <InlineEditText
                value={note.body}
                onSave={value => updateNote.mutateAsync({ noteId: note.id, body: value ?? '' })}
                multiline
              />
            </div>
          ))}
        </div>
      </DataSection>
    </div>
  )
}
