import type { Contact, ContactInput, ContactPatchInput } from '../types'
import { apiFetch } from './client'

export function listDealContacts(dealId: string): Promise<Contact[]> {
  return apiFetch(`/api/deals/${dealId}/contacts`)
}

export function createContact(body: Partial<ContactInput>): Promise<Contact> {
  return apiFetch('/api/contacts', { method: 'POST', body: JSON.stringify(body) })
}

export function updateContact(contactId: string, body: ContactPatchInput): Promise<Contact> {
  return apiFetch(`/api/contacts/${contactId}`, { method: 'PATCH', body: JSON.stringify(body) })
}
