import { createContext, useCallback, useContext, useRef, useState } from 'react'
import styles from './Toast.module.css'

interface ToastState {
  message: string
  isError: boolean
  visible: boolean
}

interface ToastContextValue {
  showToast: (message: string, isError?: boolean) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', isError: false, visible: false })
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((message: string, isError = false) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, isError, visible: true })
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2800)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={[styles.toast, toast.visible ? styles.visible : '', toast.isError ? styles.error : ''].join(' ')}
        role="status"
        aria-live="polite"
      >
        {toast.message}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
