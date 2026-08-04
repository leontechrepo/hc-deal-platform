import type { ChatMessage, ChatSendResponse, ChatSessionSummary } from '../types'
import { apiFetch } from './client'

export function sendChatMessage(body: {
  sessionId: string | null
  message: string
  dealId?: number | null
}): Promise<ChatSendResponse> {
  return apiFetch(`/api/chat`, {
    method: 'POST',
    body: JSON.stringify({
      session_id: body.sessionId,
      message: body.message,
      deal_id: body.dealId ?? null,
    }),
  })
}

export function listChatSessions(): Promise<ChatSessionSummary[]> {
  return apiFetch('/api/chat/sessions')
}

export function getChatSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  return apiFetch(`/api/chat/sessions/${sessionId}/messages`)
}

export function deleteChatSession(sessionId: string): Promise<void> {
  return apiFetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
}
