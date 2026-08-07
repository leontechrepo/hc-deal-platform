import type { DealTimeline, DealTimelineTask, DealTimelineWorkstream, TimelineTemplate } from '../types'
import { apiFetch } from './client'

export function getDealTimeline(dealId: string): Promise<DealTimeline> {
  return apiFetch(`/api/deals/${dealId}/timeline`)
}

export function listTimelineTemplates(): Promise<TimelineTemplate[]> {
  return apiFetch('/api/timeline/templates')
}

export function applyTimelineTemplate(
  dealId: string,
  templateName: string,
  startDate?: string | null,
  actor?: string,
): Promise<DealTimeline> {
  return apiFetch(`/api/deals/${dealId}/timeline/from-template`, {
    method: 'POST',
    body: JSON.stringify({ template_name: templateName, start_date: startDate || undefined, actor }),
  })
}

export function createWorkstream(dealId: string, name: string, sortOrder = 0): Promise<DealTimelineWorkstream> {
  return apiFetch(`/api/deals/${dealId}/timeline/workstreams`, {
    method: 'POST',
    body: JSON.stringify({ name, sort_order: sortOrder }),
  })
}

export function patchWorkstream(
  workstreamId: number,
  body: { name?: string; sort_order?: number },
): Promise<{ id: number; name: string; sort_order: number }> {
  return apiFetch(`/api/timeline/workstreams/${workstreamId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteWorkstream(workstreamId: number): Promise<{ ok: boolean; workstream_id: number }> {
  return apiFetch(`/api/timeline/workstreams/${workstreamId}`, { method: 'DELETE' })
}

export interface CreateTaskInput {
  name: string
  owner?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string
  is_milestone?: boolean
  sort_order?: number
}

export function createTask(workstreamId: number, body: CreateTaskInput): Promise<DealTimelineTask> {
  return apiFetch(`/api/timeline/workstreams/${workstreamId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export interface PatchTaskInput {
  name?: string
  owner?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string
  is_milestone?: boolean
  sort_order?: number
}

export function patchTask(taskId: number, body: PatchTaskInput): Promise<DealTimelineTask> {
  return apiFetch(`/api/timeline/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteTask(taskId: number): Promise<{ ok: boolean; task_id: number }> {
  return apiFetch(`/api/timeline/tasks/${taskId}`, { method: 'DELETE' })
}
