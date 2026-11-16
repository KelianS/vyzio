import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, TriangleAlert, X } from 'lucide-react'
import { PressableControl, PressableSurface } from '../../../common/components/pressable'
import { formatSince, stillDismissed, trackFirstSeen, type BarAlert } from '../bar_alerts'

const SINCE_TICK_MS = 30_000

/** The alerts the bar grows for, the most recent first (UI-30). */
export function BarAlertList({ alerts }: { alerts: readonly BarAlert[] }) {
  const [now, setNow] = useState(() => Date.now())
  const [firstSeen, setFirstSeen] = useState<Record<string, number>>({})
  const [dismissed, setDismissed] = useState<readonly string[]>([])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), SINCE_TICK_MS)
    return () => clearInterval(interval)
  }, [])

  const keys = alerts.map((alert) => alert.key)
  const tracked = trackFirstSeen(firstSeen, keys, now)
  // Adjusted while rendering, as React advises for state derived from props: no effect, no flash.
  if (Object.keys(tracked).join('|') !== Object.keys(firstSeen).join('|')) setFirstSeen(tracked)
  const kept = stillDismissed(dismissed, keys)
  if (kept.length !== dismissed.length) setDismissed(kept)

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
        return (
          <li key={alert.key} className="flex items-center rounded-inset bg-bar-plate">
            {alert.to ? (
              <PressableSurface>
                <Link to={alert.to} className={line}>
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
                  onClick={() => setDismissed([...kept, alert.key])}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </PressableControl>
            )}
          </li>
        )
      })}
    </ul>
  )
}
