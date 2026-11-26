import { useEffect, useRef } from 'react'
import { CalendarOff, ImageOff } from 'lucide-react'
import { prefersReducedMotion } from '../motion/springs'
import { cn } from '../ui/utils'
import { DetectionThumbnail } from '../components/detection_thumbnail'
import { DetectionTypeIcon } from './detection_type_icon'
import { PressableSurface } from '../components/pressable'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import {
  formatClipDetail,
  formatEventTitle,
  groupClipsByDay,
  thumbnailUrl,
} from './detection_formatters'

const TILE = 'h-14 w-22 rounded-md'

/** The clips of a camera or of the house, by day, each row playing its clip in the player above. */
export function ClipList({
  events,
  labels,
  apiBaseUrl,
  playingId,
  withCamera = false,
  follow = false,
  now,
  onPlay,
}: {
  events: readonly DetectionEvent[]
  /** What names a detection nobody was recognised in. */
  labels: readonly DetectionLabel[]
  apiBaseUrl: string
  /** The clip the player holds, drawn as the current row. */
  playingId: string | null
  /** The clips come from several cameras: each line says which. */
  withCamera?: boolean
  /** The clip in the player started on its own: its row comes into view, never after a tap. */
  follow?: boolean
  now: Date
  onPlay: (event: DetectionEvent) => void
}) {
  const playingRow = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (follow)
      playingRow.current?.scrollIntoView({
        block: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })
  }, [follow, playingId])

  return (
    <div className="flex flex-col gap-6">
      {groupClipsByDay(events, now).map(({ day, events: ofDay }) => (
        <section key={day} aria-label={day} className="flex flex-col gap-2">
          <h3 className="ml-1 text-label font-semibold text-muted-foreground">{day}</h3>
          <ul className="overflow-hidden rounded-card bg-card">
            {ofDay.map((event, index) => {
              const title = formatEventTitle(event, labels)
              const playing = event.eventId === playingId
              return (
                <li key={event.eventId}>
                  {index > 0 && <div className="ml-27.5 h-px bg-border" aria-hidden="true" />}
                  <PressableSurface>
                    <button
                      ref={playing ? playingRow : undefined}
                      type="button"
                      aria-current={playing ? 'true' : undefined}
                      onClick={() => onPlay(event)}
                      className={cn(
                        // Clear of the bar and of the player that stick above the list.
                        'scroll-mt-[calc(var(--top-bar-height,0px)+var(--clip-player-height,0px))]',
                        'flex min-h-19 w-full items-center gap-3 py-2.5 pr-4 pl-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
                        playing && 'bg-secondary',
                      )}
                    >
                      {event.mediaExpired || !event.hasSnapshot ? (
                        <span
                          aria-hidden="true"
                          className={cn(
                            TILE,
                            'flex shrink-0 items-center justify-center bg-picture text-muted-foreground',
                          )}
                        >
                          {event.mediaExpired ? (
                            <CalendarOff className="size-5" />
                          ) : (
                            <ImageOff className="size-5" />
                          )}
                        </span>
                      ) : (
                        <DetectionThumbnail
                          src={thumbnailUrl(apiBaseUrl, event.eventId)}
                          className={cn(TILE, 'bg-picture')}
                          retryable={false}
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <DetectionTypeIcon label={event.label} />
                          <span className="truncate text-row font-semibold">{title}</span>
                        </span>
                        <span className="text-body text-muted-foreground">
                          {/* A row of a mixed list leaves how sure to the player, so it stays on one line. */}
                          {formatClipDetail(event, { camera: withCamera, howSure: !withCamera })}
                        </span>
                      </span>
                    </button>
                  </PressableSurface>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
