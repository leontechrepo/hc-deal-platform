import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptInboxGroup,
  dismissInboxGroup,
  fileUnfiledDocument,
  listInbox,
  listUnfiledDocuments,
  readInboxEmail,
  type AcceptGroupBody,
} from '../api/inbox'

export function useInbox() {
  return useQuery({
    queryKey: ['review-queue'],
    queryFn: listInbox,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

/**
 * Sidebar badge — pending *emails*, the same unit as the Queue panel and the
 * "Pending emails" KPI. (Suggested updates are counted separately; one email
 * can carry several.)
 */
export function usePendingCount(): number {
  const { data } = useInbox()
  return data ? data.length : 0
}

export function usePendingSuggestionCount(): number {
  const { data } = useInbox()
  return data ? data.reduce((n, g) => n + g.suggestions.length, 0) : 0
}

export function useAcceptInboxGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: string; body: AcceptGroupBody }) =>
      acceptInboxGroup(groupId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      // Accepting files the email's attachments to the deal.
      qc.invalidateQueries({ queryKey: ['unfiled-documents'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

export function useDismissInboxGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId }: { groupId: string }) => dismissInboxGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  })
}

export function useUnfiledDocuments() {
  return useQuery({
    queryKey: ['unfiled-documents'],
    queryFn: listUnfiledDocuments,
    staleTime: 0,
  })
}

export function useFileUnfiledDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ docId, dealId }: { docId: number; dealId: string }) =>
      fileUnfiledDocument(docId, dealId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['unfiled-documents'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useEmailBody(groupId: string) {
  return useQuery({
    queryKey: ['inbox-email-body', groupId],
    queryFn: () => readInboxEmail(groupId),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
