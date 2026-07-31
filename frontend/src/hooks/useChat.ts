import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { sendChatMessage } from '../api/chat'
import { ApiError } from '../api/client'
import type { ChatMessage } from '../types'

const STORAGE_KEY = 'credit-copilot-session'

interface StoredSession {
  sessionId: string | null
  messages: ChatMessage[]
}

function loadStoredSession(): StoredSession {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { sessionId: null, messages: [] }
    const parsed = JSON.parse(raw)
    return { sessionId: parsed.sessionId ?? null, messages: Array.isArray(parsed.messages) ? parsed.messages : [] }
  } catch {
    return { sessionId: null, messages: [] }
  }
}

function errorReply(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Too many messages — please wait a moment and try again.'
    if (err.status === 503) return 'Chat is not configured yet.'
    return "Something went wrong reaching Credit Co-Pilot — please try again."
  }
  return "Something went wrong reaching Credit Co-Pilot — please try again."
}

export function useChat() {
  const initial = useRef(loadStoredSession())
  const [messages, setMessages] = useState<ChatMessage[]>(initial.current.messages)
  const [sessionId, setSessionId] = useState<string | null>(initial.current.sessionId)
  const lastUserMessage = useRef<string | null>(null)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages }))
  }, [sessionId, messages])

  const mutation = useMutation({
    mutationFn: (message: string) => sendChatMessage({ sessionId, message }),
    onSuccess: (data) => {
      setSessionId(data.session_id)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    },
    onError: (err) => {
      setMessages(prev => [...prev, { role: 'assistant', content: errorReply(err), error: true }])
    },
  })

  const sendMessage = useCallback((message: string) => {
    const trimmed = message.trim()
    if (!trimmed) return
    lastUserMessage.current = trimmed
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    mutation.mutate(trimmed)
  }, [mutation])

  const retry = useCallback(() => {
    if (!lastUserMessage.current) return
    mutation.mutate(lastUserMessage.current)
  }, [mutation])

  return {
    messages,
    sendMessage,
    retry,
    isPending: mutation.isPending,
    canRetry: mutation.isError && lastUserMessage.current !== null,
  }
}
