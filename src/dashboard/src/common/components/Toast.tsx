import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../ui/utils'

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
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-50 grid gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {items.map((item) => (
          <ToastChip key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const TONE_ICON: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-surface-inverse-foreground',
}

function ToastChip({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 4000)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss])

  const Icon = TONE_ICON[item.tone]

  return (
    <div
      role="status"
      className="pointer-events-auto flex min-w-60 max-w-sm items-center gap-3 rounded-lg bg-surface-inverse px-4 py-3 text-surface-inverse-foreground shadow-[var(--shadow-soft)]"
    >
      <Icon className={cn('size-4 shrink-0', TONE_ICON_CLASS[item.tone])} aria-hidden="true" />
      <span className="flex-1 text-sm">{item.message}</span>
      <button
        type="button"
        aria-label="Fermer"
        className="shrink-0 opacity-60 hover:opacity-100"
        onClick={() => onDismiss(item.id)}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
