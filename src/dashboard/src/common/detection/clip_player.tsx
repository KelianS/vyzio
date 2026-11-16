import { useState, type ReactNode } from 'react'
import { cn } from '../ui/utils'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import { MEDIA_EXPIRED } from './detection_preview'
import { clipUrl, formatClipDetail, formatEventTitle, snapshotUrl } from './detection_formatters'

/** What the player holds when the detection has no video to play. */
function stillOf(event: DetectionEvent, clipGone: boolean): string | null {
  if (event.mediaExpired) return MEDIA_EXPIRED
  if (clipGone) return 'La vidéo de ce moment a été supprimée.'
  if (!event.hasClip && !event.hasSnapshot) return 'Cette détection n’a ni aperçu ni vidéo.'
  return null
}

/**
 * The player of a detection, in place of a picture: its video from the start, its name and hour over
 * it, how far it has played. It stops on its last frame unless the screen goes on (`onEnded`).
 */
export function ClipPlayer({
  event,
  labels,
  apiBaseUrl,
  clipGone,
  className,
  onVideoError,
  onEnded,
  children,
}: {
  event: DetectionEvent
  labels: readonly DetectionLabel[]
  apiBaseUrl: string
  /** The video was erased with another detection: said as such, never as a broken player (HIST-11). */
  clipGone: boolean
  className?: string
  onVideoError: () => void
  onEnded?: () => void
  /** What the screen lays over the player, such as the way back to the live picture. */
  children?: ReactNode
}) {
  const [played, setPlayed] = useState(0)
  const still = stillOf(event, clipGone)
  const video = !still && event.hasClip

  return (
    <div
      role="group"
      aria-label={`Détection : ${formatEventTitle(event, labels)}`}
      className={cn('relative overflow-hidden bg-picture', className)}
    >
      {video && (
        <video
          key={event.eventId}
          src={clipUrl(apiBaseUrl, event.eventId)}
          autoPlay
          playsInline
          aria-label={formatEventTitle(event, labels)}
          className="absolute inset-0 size-full object-contain"
          onTimeUpdate={(e) => {
            const { currentTime, duration } = e.currentTarget
            if (duration > 0) setPlayed(currentTime / duration)
          }}
          onEnded={onEnded}
          onError={onVideoError}
        />
      )}
      {!still && !video && (
        <img
          src={snapshotUrl(apiBaseUrl, event.eventId)}
          alt={formatEventTitle(event, labels)}
          className="absolute inset-0 size-full object-contain"
        />
      )}
      {still && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-body text-ink-muted">
          {still}
        </p>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-picture/80 to-transparent px-3 pt-8 pb-3">
        <p className="text-row font-semibold">{formatEventTitle(event, labels)}</p>
        <p className="text-label font-semibold text-ink-muted">{formatClipDetail(event)}</p>
      </div>
      {video && (
        <div className="absolute inset-x-0 bottom-0 h-0.75 bg-foreground/20" aria-hidden="true">
          <div className="h-full bg-foreground" style={{ width: `${played * 100}%` }} />
        </div>
      )}
      {children}
    </div>
  )
}
