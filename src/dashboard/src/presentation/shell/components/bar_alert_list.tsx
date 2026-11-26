import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, TriangleAlert, X } from 'lucide-react'
import { motionValue } from 'motion/react'
import { PressableControl, PressableSurface } from '../../../common/components/pressable'
import { holdsItsOwnDrag, projection, useFingerDrag } from '../../../common/motion/gesture'
import { paintOn, translation } from '../../../common/motion/ghost'
import { prefersReducedMotion, springTo } from '../../../common/motion/springs'
import { formatSince, stillDismissed, trackFirstSeen, type BarAlert } from '../bar_alerts'

const SINCE_TICK_MS = 30_000
const DISMISSED_KEY = 'vyzio.bar-alerts.dismissed'

/** What this device set aside, kept over a reload; none when the browser keeps nothing. */
function readDismissed(): readonly string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((key) => typeof key === 'string') : []
  } catch {
    return []
  }
}

function saveDismissed(dismissed: readonly string[]): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed))
  } catch {
    // A browser that keeps nothing forgets the dismissal at the next opening, nothing worse.
  }
}

// The share of its width an alert must be thrown past to leave, and how far beyond its edge it flies.
const THROWN_PAST = 0.45
const FLIGHT_MARGIN = 40

/** One alert line; one that can be set aside also leaves by a sideways swipe, as its close button does (UI-30). */
function AlertLine({
  dismissible,
  onDismiss,
  children,
}: {
  dismissible: boolean
  onDismiss: () => void
  children: ReactNode
}) {
  const [line, setLine] = useState<HTMLLIElement | null>(null)
  const [x] = useState(() => motionValue(0))
  const [opacity] = useState(() => motionValue(1))
  const grabbed = useRef(0)

  useLayoutEffect(() => {
    if (!line) return
    return paintOn([x, opacity], () => {
      line.style.transform = translation(x.get(), 0)
      const thrown = Math.min(1, Math.abs(x.get()) / Math.max(1, line.offsetWidth))
      line.style.opacity =
        thrown === 0 && opacity.get() === 1 ? '' : String(opacity.get() * (1 - thrown))
    })
  }, [line, x, opacity])

  const drag = useFingerDrag('x', {
    canStart: (target) => dismissible && !holdsItsOwnDrag(target),
    onStart: () => {
      x.stop()
      grabbed.current = x.get()
    },
    onMove: (offset) => x.set(grabbed.current + offset),
    onEnd: (_offset, velocity) => {
      const width = Math.max(1, line?.offsetWidth ?? 1)
      const landing = x.get() + projection(velocity)
      if (Math.abs(landing) <= width * THROWN_PAST) {
        void springTo(x, 0, 'arrival', velocity)
        return
      }
      const leaving = prefersReducedMotion()
        ? springTo(opacity, 0, 'departure')
        : springTo(x, Math.sign(landing) * (width + FLIGHT_MARGIN), 'departure', velocity)
      void leaving.then(onDismiss)
    },
  })

  return (
    <li
      ref={setLine}
      {...(dismissible ? drag : {})}
      className="flex touch-pan-y items-center rounded-inset bg-bar-plate"
    >
      {children}
    </li>
  )
}

/** The alerts the bar grows for, the most recent first (UI-30); `factsRead` once they come from a real read. */
export function BarAlertList({
  alerts,
  factsRead,
}: {
  alerts: readonly BarAlert[]
  factsRead: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  const [firstSeen, setFirstSeen] = useState<Record<string, number>>({})
  const [dismissed, setDismissed] = useState<readonly string[]>(readDismissed)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), SINCE_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  const keys = alerts.map((alert) => alert.key)
  const tracked = trackFirstSeen(firstSeen, keys, now)
  // Adjusted while rendering, as React advises for state derived from props: no effect, no flash.
  if (Object.keys(tracked).join('|') !== Object.keys(firstSeen).join('|')) setFirstSeen(tracked)
  const kept = stillDismissed(dismissed, keys, factsRead)
  if (kept.length !== dismissed.length) setDismissed(kept)

  useEffect(() => saveDismissed(dismissed), [dismissed])

  const shown = alerts.filter((alert) => !kept.includes(alert.key))
  if (shown.length === 0) return null

  const ordered = [...shown].sort((a, b) => tracked[b.key] - tracked[a.key])

  return (
    <ul aria-label="Alertes" className="flex flex-col gap-2">
      {ordered.map((alert) => {
        const second = alert.detail ?? `${alert.since} ${formatSince(now - tracked[alert.key])}`
        const content = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-semibold">{alert.title}</span>
              <span className="text-label text-ink-muted">{second}</span>
            </span>
            {alert.to && <ChevronRight className="size-5 shrink-0" aria-hidden="true" />}
          </>
        )
        const line = 'flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-inset p-3'
        const dismiss = () => setDismissed([...kept, alert.key])
        return (
          <AlertLine
            key={alert.key}
            dismissible={alert.dismissible}
            onDismiss={() => setDismissed((previous) => [...previous, alert.key])}
          >
            {alert.to ? (
              <PressableSurface>
                <Link
                  to={alert.to}
                  className={line}
                  onClick={alert.dismissible ? dismiss : undefined}
                >
                  {content}
                </Link>
              </PressableSurface>
            ) : (
              <div className={line}>{content}</div>
            )}
            {alert.dismissible && (
              <PressableControl>
                <button
                  type="button"
                  aria-label={`Masquer : ${alert.title}`}
                  className="mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={dismiss}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </PressableControl>
            )}
          </AlertLine>
        )
      })}
    </ul>
  )
}
