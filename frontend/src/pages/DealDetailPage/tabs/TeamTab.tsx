import { useState } from 'react'
import { useDealContext } from '../dealContext'
import {
  useCreateTeamMember, useDealTeamMembers, useDeleteTeamMember, useUpdateTeamMember,
} from '../../../hooks/useDealTeam'
import { useCreateContact, useDealContacts, useUpdateContact } from '../../../hooks/useContacts'
import { TeamMemberFormModal } from '../../../components/dealteam/TeamMemberFormModal'
import { ContactFormModal } from '../../../components/dealteam/ContactFormModal'
import { Button } from '@leontechrepo/leon-ui'
import { DataSection } from '../../../components/dealDetail/DataSection'
import { RowActions } from '../../../components/ui/RowActions'
import { DataTable, type Column } from '../../../components/ui/DataTable/DataTable'
import { useToast } from '../../../components/Toast/Toast'
import type {
  Contact, ContactInput, ContactPatchInput, DealTeamMember, DealTeamMemberInput,
} from '../../../types'

export function TeamTab() {
  const { deal } = useDealContext()
  const { showToast } = useToast()

  const { data: teamMembers = [], isLoading: teamLoading, isError: teamError } = useDealTeamMembers(deal.id)
  const createTeamMember = useCreateTeamMember(deal.id)
  const updateTeamMember = useUpdateTeamMember(deal.id)
  const deleteTeamMember = useDeleteTeamMember(deal.id)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [editingTeamMember, setEditingTeamMember] = useState<DealTeamMember | null>(null)

  const { data: contacts = [], isLoading: contactsLoading, isError: contactsError } = useDealContacts(deal.id)
  const createContact = useCreateContact()
  const updateContact = useUpdateContact(deal.id)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  function openCreateTeamMember() {
    setEditingTeamMember(null)
    setTeamModalOpen(true)
  }

  function openEditTeamMember(member: DealTeamMember) {
    setEditingTeamMember(member)
    setTeamModalOpen(true)
  }

  async function submitTeamMember(body: Partial<DealTeamMemberInput>) {
    if (editingTeamMember) {
      await updateTeamMember.mutateAsync({ teamId: editingTeamMember.team_id, body })
      showToast('Team member updated')
    } else {
      await createTeamMember.mutateAsync(body)
      showToast('Team member added')
    }
  }

  async function removeTeamMember(member: DealTeamMember) {
    if (!window.confirm(`Remove ${member.team_member} from the deal team?`)) return
    try {
      await deleteTeamMember.mutateAsync(member.team_id)
      showToast('Team member removed')
    } catch {
      showToast('Remove failed', true)
    }
  }

  function openCreateContact() {
    setEditingContact(null)
    setContactModalOpen(true)
  }

  function openEditContact(contact: Contact) {
    setEditingContact(contact)
    setContactModalOpen(true)
  }

  async function submitContact(body: Partial<ContactInput> | ContactPatchInput) {
    if (editingContact) {
      await updateContact.mutateAsync({ contactId: editingContact.contact_id, body: body as ContactPatchInput })
      showToast('Contact updated')
    } else {
      await createContact.mutateAsync({ ...body, deal_id: deal.id } as Partial<ContactInput>)
      showToast('Contact added')
    }
  }

  const teamColumns: Column<DealTeamMember>[] = [
    { key: 'team_member', header: 'Name', render: m => m.team_member },
    { key: 'role_on_deal', header: 'Role', render: m => m.role_on_deal || '—' },
    {
      key: 'actions',
      header: '',
      render: m => (
        <RowActions>
          <Button variant="ghost" size="sm" onClick={() => openEditTeamMember(m)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => removeTeamMember(m)}>Remove</Button>
        </RowActions>
      ),
    },
  ]

  const contactColumns: Column<Contact>[] = [
    { key: 'name', header: 'Name', render: c => c.name },
    { key: 'role', header: 'Role', render: c => c.role || '—' },
    { key: 'email', header: 'Email', render: c => c.email || '—' },
    { key: 'last_interaction_date', header: 'Last Interaction', render: c => c.last_interaction_date || '—' },
    { key: 'next_touchpoint_due', header: 'Next Touchpoint', render: c => c.next_touchpoint_due || '—' },
    {
      key: 'actions',
      header: '',
      render: c => <Button variant="ghost" size="sm" onClick={() => openEditContact(c)}>Edit</Button>,
    },
  ]

  return (
    <div className="detail-cards">
      <DataSection
        title="Deal Team"
        noun="team"
        actions={<Button variant="secondary" size="sm" onClick={openCreateTeamMember}>Add Team Member</Button>}
        isLoading={teamLoading}
        isError={teamError}
        isEmpty={teamMembers.length === 0}
        emptyTitle="No team members yet"
        emptyDescription="Assign the internal deal team."
      >
        <DataTable columns={teamColumns} rows={teamMembers} rowKey={m => m.team_id} />
      </DataSection>

      <DataSection
        title="Contacts"
        noun="contacts"
        actions={<Button variant="secondary" size="sm" onClick={openCreateContact}>Add Contact</Button>}
        isLoading={contactsLoading}
        isError={contactsError}
        isEmpty={contacts.length === 0}
        emptyTitle="No contacts yet"
        emptyDescription="Add borrower-side or sponsor-side contacts for this deal."
      >
        <DataTable columns={contactColumns} rows={contacts} rowKey={c => c.contact_id} />
      </DataSection>

      <TeamMemberFormModal
        open={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        initial={editingTeamMember}
        onSubmit={submitTeamMember}
      />
      <ContactFormModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        initial={editingContact}
        defaultCompanyId={deal.company_id}
        onSubmit={submitContact}
      />
    </div>
  )
}
