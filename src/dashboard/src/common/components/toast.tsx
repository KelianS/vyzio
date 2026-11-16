import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, Info, RotateCw, X, XCircle } from 'lucide-react'
import { motionValue } from 'motion/react'
import { cn } from '../ui/utils'
import { projection, rubberBand, useFingerDrag } from '../motion/gesture'
import { paintOn, translation } from '../motion/ghost'
import { prefersReducedMotion, springTo } from '../motion/springs'
import { PressableControl } from './pressable'
import { SecondaryButton } from './secondary_button'

export type ToastTone = 'success' | 'error' | 'info'

/** The one thing a toast may offer: doing the act again (DESIGN SYSTEM § Where feedback goes). */
interface ToastAction {
  readonly label: string
  readonly onClick: () => void
}

export type Toast = (
  message: string,
  tone?: ToastTone,
  diagnostic?: string,
  action?: ToastAction,
) => void

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  diagnostic?: string
  action?: ToastAction
  leaving?: boolean
}

interface ToastContextValue {
  toast: Toast
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined })

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback<Toast>((message, tone = 'info', diagnostic, action) => {
    const id = nextId++
    // The same failure raised twice in a row is one thing to read, not a pile to close one by one:
    // raised again while it fades out, it comes back.
    setItems((prev) => {
      const same = prev.find(
        (item) => item.message === message && item.tone === tone && item.diagnostic === diagnostic,
      )
      if (!same) return [...prev, { id, message, tone, diagnostic, action }]
      if (!same.leaving) return prev
      return prev.map((item) => (item === same ? { ...item, leaving: false } : item))
    })
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
  }, [])

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="region"
        // Above every Radix layer (`z-50`): a camera refusing a move shows while watching it.
        className="pointer-events-none fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-300 grid gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {items.map((item) => (
          <ToastChip key={item.id} item={item} onDismiss={dismiss} onGone={remove} />
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
  info: 'text-ink-muted',
}

// How far below its place a toast starts and ends, in its own heights: out of sight under the screen's edge.
const OUT_OF_SIGHT = 1.6

function ToastChip({
  item,
  onDismiss,
  onGone,
}: {
  item: ToastItem
  onDismiss: (id: number) => void
  onGone: (id: number) => void
}) {
  const [chip, setChip] = useState<HTMLDivElement | null>(null)
  const [y] = useState(() => motionValue(0))
  const [opacity] = useState(() => motionValue(1))
  const [held, setHeld] = useState(false)
  const grabbed = useRef(0)
  const flung = useRef<number | undefined>(undefined)
  const shown = useRef(false)
  // A diagnostic may have to be photographed (UI-03), an action needs the time to be taken.
  const closesItself = item.diagnostic === undefined && item.action === undefined
  useEffect(() => {
    if (!closesItself || item.leaving || held) return
    const timer = setTimeout(() => onDismiss(item.id), 4000)
    return () => clearTimeout(timer)
  }, [item.id, item.leaving, onDismiss, closesItself, held])

  useLayoutEffect(() => {
    if (!chip) return
    const height = () => Math.max(1, chip.offsetHeight)
    return paintOn([y, opacity], () => {
      chip.style.transform = translation(0, y.get())
      const lowered = Math.min(1, Math.max(0, y.get() / (height() * OUT_OF_SIGHT)))
      chip.style.opacity = String(opacity.get() * (1 - lowered))
    })
  }, [chip, y, opacity])

  // It rises at the bottom, leaves downwards, and comes back when raised again while it leaves.
  useLayoutEffect(() => {
    if (!chip) return
    const reduced = prefersReducedMotion()
    const away = chip.offsetHeight * OUT_OF_SIGHT
    if (item.leaving) {
      const velocity = flung.current
      flung.current = undefined
      const leaving = reduced
        ? springTo(opacity, 0, 'departure')
        : springTo(y, Math.max(away, y.get()), 'departure', velocity)
      let gone = false
      void leaving.then(() => {
        if (!gone) onGone(item.id)
      })
      return () => {
        gone = true
      }
    }
    // Under reduced motion it fades in by the stylesheet, and only a raised-again toast is brought back here.
    if (reduced) {
      if (shown.current) void springTo(opacity, 1, 'arrival')
    } else {
      opacity.jump(1)
      if (!shown.current) y.jump(Math.max(1, away))
      void springTo(y, 0, 'arrival')
    }
    shown.current = true
  }, [chip, item.leaving, item.id, onGone, y, opacity])

  const drag = useFingerDrag('y', {
    // Only its top edge: a scroll or a selection starting on the text never closes it (UI-03).
    canStart: (target) =>
      !item.leaving && target instanceof Element && target.closest('[data-toast-handle]') !== null,
    onStart: () => {
      setHeld(true)
      y.stop()
      grabbed.current = y.get()
    },
    onMove: (offset) => {
      const next = grabbed.current + offset
      const height = Math.max(1, chip?.offsetHeight ?? 1)
      // Upwards it has nowhere to go: it stretches, never under reduced motion.
      y.set(next >= 0 ? next : prefersReducedMotion() ? 0 : rubberBand(next, height))
    },
    onEnd: (_offset, velocity) => {
      setHeld(false)
      const height = Math.max(1, chip?.offsetHeight ?? 1)
      // A deliberate gesture closes it like its close button (UI-03).
      if (y.get() + projection(velocity) > height / 2) {
        flung.current = velocity
        onDismiss(item.id)
      } else void springTo(y, 0, 'arrival', velocity)
    },
  })

  const Icon = TONE_ICON[item.tone]

  return (
    <div
      ref={setChip}
      role="status"
      {...drag}
      className={cn(
        'pointer-events-auto relative flex min-w-60 max-w-sm items-start gap-3 rounded-card bg-picture px-4 py-3 text-ink-muted',
        'motion-reduce:transition-opacity motion-reduce:starting:opacity-0',
        item.leaving && 'pointer-events-none',
      )}
    >
      {/* The edge a finger pulls it down by: finger-sized, over its top padding and the gap above it. */}
      <span
        data-toast-handle
        aria-hidden="true"
        className="absolute inset-x-0 -top-2 h-5 touch-none"
      />
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', TONE_ICON_CLASS[item.tone])}
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className="text-body">{item.message}</p>
        {item.diagnostic && (
          <p className="mt-1 font-mono text-label break-all text-ink-muted/70 select-text">
            {item.diagnostic}
          </p>
        )}
        {item.action && (
          <SecondaryButton
            icon={RotateCw}
            type="button"
            size="sm"
            className="mt-2"
            onClick={() => {
              onDismiss(item.id)
              item.action?.onClick()
            }}
          >
            {item.action.label}
          </SecondaryButton>
        )}
      </div>
      <PressableControl>
        <button
          type="button"
          aria-label="Fermer"
          className="shrink-0 opacity-60 hover:opacity-100"
          onClick={() => onDismiss(item.id)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </PressableControl>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
