import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyTimelineTemplate, createTask, createWorkstream, deleteTask, deleteWorkstream,
  getDealTimeline, listTimelineTemplates, patchTask, patchWorkstream,
} from '../api/dealTimeline'
import type { CreateTaskInput, PatchTaskInput } from '../api/dealTimeline'

export function useDealTimeline(dealId: number | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'timeline'],
    queryFn: () => getDealTimeline(dealId as number),
    enabled: dealId !== null,
  })
}

export function useTimelineTemplates() {
  return useQuery({ queryKey: ['timeline-templates'], queryFn: listTimelineTemplates })
}

export function useApplyTimelineTemplate(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ templateName, startDate, actor }: { templateName: string; startDate?: string | null; actor?: string }) =>
      applyTimelineTemplate(dealId, templateName, startDate, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'timeline'] }),
  })
}

export function useCreateWorkstream(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, sortOrder }: { name: string; sortOrder?: number }) => createWorkstream(dealId, name, sortOrder),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'timeline'] }),
  })
}

export function usePatchWorkstream(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workstreamId, body }: { workstreamId: number; body: { name?: string; sort_order?: number } }) =>
      patchWorkstream(workstreamId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'timeline'] }),
  })
}

export function useDeleteWorkstream(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workstreamId: number) => deleteWorkstream(workstreamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'timeline'] }),
  })
}

export function useCreateTask(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workstreamId, body }: { workstreamId: number; body: CreateTaskInput }) => createTask(workstreamId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'timeline'] }),
  })
}

export function usePatchTask(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: number; body: PatchTaskInput }) => patchTask(taskId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'timeline'] }),
  })
}

export function useDeleteTask(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (taskId: number) => deleteTask(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'timeline'] }),
  })
}
