import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined })

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++
    setItems((prev) => [...prev, { id, message, tone }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toaster" aria-live="polite" aria-label="Notifications">
        {items.map((item) => (
          <ToastChip key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastChip({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss])

  return (
    <div className={`toast toast--${item.tone}`} role="status">
      <span>{item.message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Fermer"
        onClick={() => onDismiss(item.id)}
      >
        ×
      </button>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
