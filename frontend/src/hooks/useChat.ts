import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/react'
import { deleteChatSession, getChatSessionMessages, listChatSessions, sendChatMessage } from '../api/chat'
import { ApiError } from '../api/client'
import type { ChatMessage } from '../types'

function errorReply(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Too many messages — please wait a moment and try again.'
    if (err.status === 503) return 'Chat is not configured yet.'
    return "Something went wrong reaching Credit Co-Pilot — please try again."
  }
  return "Something went wrong reaching Credit Co-Pilot — please try again."
}

export function useChat() {
  // Query keys are scoped by signed-in user so a browser-tab account switch
  // never leaks the previous user's session list/messages to the next
  // signed-in user, even though they share the same QueryClient instance.
  const { user } = useUser()
  const userId = user?.id ?? null
  const qc = useQueryClient()

  const sessionsQuery = useQuery({
    queryKey: ['chat-sessions', userId],
    queryFn: listChatSessions,
    enabled: userId !== null,
  })
  const sessions = sessionsQuery.data ?? []

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [hasChosenSession, setHasChosenSession] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const lastUserMessage = useRef<string | null>(null)

  // Reset per-user state when the signed-in user changes.
  useEffect(() => {
    setActiveSessionId(null)
    setHasChosenSession(false)
    setMessages([])
    lastUserMessage.current = null
  }, [userId])

  // Default to the most recently active session once the list loads, unless
  // the user has already explicitly picked "new chat" or another session.
  useEffect(() => {
    if (!hasChosenSession && sessions.length > 0) {
      setActiveSessionId(sessions[0].id)
    }
  }, [hasChosenSession, sessions])

  const messagesQuery = useQuery({
    queryKey: ['chat-messages', userId, activeSessionId],
    queryFn: () => getChatSessionMessages(activeSessionId as string),
    enabled: activeSessionId !== null,
  })

  useEffect(() => {
    if (activeSessionId === null) {
      setMessages([])
      return
    }
    if (messagesQuery.data) {
      setMessages(messagesQuery.data)
    }
  }, [activeSessionId, messagesQuery.data])

  const mutation = useMutation({
    mutationFn: (message: string) => sendChatMessage({ sessionId: activeSessionId, message }),
    onSuccess: (data) => {
      setActiveSessionId(data.session_id)
      setHasChosenSession(true)
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      qc.invalidateQueries({ queryKey: ['chat-sessions', userId] })
    },
    onError: (err) => {
      setMessages(prev => [...prev, { role: 'assistant', content: errorReply(err), error: true }])
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteChatSession(sessionId),
    onSuccess: (_data, sessionId) => {
      qc.invalidateQueries({ queryKey: ['chat-sessions', userId] })
      if (sessionId === activeSessionId) {
        setActiveSessionId(null)
        setHasChosenSession(true)
        setMessages([])
      }
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

  const newChat = useCallback(() => {
    setActiveSessionId(null)
    setHasChosenSession(true)
    setMessages([])
    lastUserMessage.current = null
  }, [])

  const selectSession = useCallback((sessionId: string) => {
    // Clear immediately rather than waiting on messagesQuery to resolve for
    // the new id — otherwise the previous session's transcript stays on
    // screen (looking like it belongs to the newly-selected chat) until the
    // fetch completes, or indefinitely if it errors.
    setMessages([])
    setActiveSessionId(sessionId)
    setHasChosenSession(true)
    lastUserMessage.current = null
  }, [])

  const deleteSession = useCallback((sessionId: string) => {
    deleteMutation.mutate(sessionId)
  }, [deleteMutation])

  return {
    sessions,
    activeSessionId,
    newChat,
    selectSession,
    deleteSession,
    messages,
    sendMessage,
    retry,
    isPending: mutation.isPending,
    canRetry: mutation.isError && lastUserMessage.current !== null,
  }
}
