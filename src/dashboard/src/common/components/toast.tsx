import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../ui/utils'

export type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  diagnostic?: string
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined })

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, tone: ToastTone = 'info', diagnostic?: string) => {
    const id = nextId++
    // The same failure raised twice in a row is one thing to read, not a pile to close one by one.
    setItems((prev) =>
      prev.some(
        (item) => item.message === message && item.tone === tone && item.diagnostic === diagnostic,
      )
        ? prev
        : [...prev, { id, message, tone, diagnostic }],
    )
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="region"
        // Above the viewer overlay (`z-200`): a camera refusing a move is read while watching it.
        className="pointer-events-none fixed right-4 bottom-4 z-300 grid gap-2"
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
  // A failure with a diagnostic stays until dismissed: it may have to be photographed (SPECS 1.5).
  const closesItself = item.diagnostic === undefined
  useEffect(() => {
    if (!closesItself) return
    const timer = setTimeout(() => onDismiss(item.id), 4000)
    return () => clearTimeout(timer)
  }, [item.id, onDismiss, closesItself])

  const Icon = TONE_ICON[item.tone]

  return (
    <div
      role="status"
      className="pointer-events-auto flex min-w-60 max-w-sm items-start gap-3 rounded-lg bg-surface-inverse px-4 py-3 text-surface-inverse-foreground shadow-[var(--shadow-soft)]"
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', TONE_ICON_CLASS[item.tone])}
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className="text-sm">{item.message}</p>
        {item.diagnostic && (
          <p className="mt-1 font-mono text-xs break-all text-surface-inverse-foreground/70 select-text">
            {item.diagnostic}
          </p>
        )}
      </div>
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
