import type { ChatSendResponse } from '../types'
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
