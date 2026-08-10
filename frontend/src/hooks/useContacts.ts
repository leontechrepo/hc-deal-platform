import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createContact, listDealContacts, updateContact } from '../api/contacts'
import type { ContactInput, ContactPatchInput } from '../types'

export function useDealContacts(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'contacts'],
    queryFn: () => listDealContacts(dealId as string),
    enabled: dealId !== null,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<ContactInput>) => createContact(body),
    onSuccess: (_data, body) => {
      if (body.deal_id) qc.invalidateQueries({ queryKey: ['deals', body.deal_id, 'contacts'] })
    },
  })
}

export function useUpdateContact(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, body }: { contactId: string; body: ContactPatchInput }) =>
      updateContact(contactId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'contacts'] }),
  })
}
