import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useUser } from '@clerk/react'
import { sendChatMessage } from '../api/chat'
import { ApiError } from '../api/client'
import type { ChatMessage } from '../types'

const STORAGE_PREFIX = 'credit-copilot-session:'

interface StoredSession {
  sessionId: string | null
  messages: ChatMessage[]
}

function loadStoredSession(storageKey: string): StoredSession {
  try {
    const raw = sessionStorage.getItem(storageKey)
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
  // Keyed per signed-in user so a browser-tab account switch never leaks the
  // previous user's messages/sessionId to the next signed-in user.
  const { user } = useUser()
  const storageKey = user?.id ? `${STORAGE_PREFIX}${user.id}` : null

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const lastUserMessage = useRef<string | null>(null)

  useEffect(() => {
    if (!storageKey) {
      setMessages([])
      setSessionId(null)
      return
    }
    const stored = loadStoredSession(storageKey)
    setMessages(stored.messages)
    setSessionId(stored.sessionId)
    lastUserMessage.current = null
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    sessionStorage.setItem(storageKey, JSON.stringify({ sessionId, messages }))
  }, [storageKey, sessionId, messages])

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
