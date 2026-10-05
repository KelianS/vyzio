import type { ReactNode } from 'react'
import { CalendarOff, Play } from 'lucide-react'
import { Button } from '../ui/button'
import { DetectionThumbnail } from '../components/detection_thumbnail'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import {
  formatEventDetail,
  formatEventTitle,
  snapshotUrl,
  thumbnailUrl,
} from './detection_formatters'

interface DetectionListProps {
  events: DetectionEvent[]
  /** What names a detection nobody was recognised in. */
  labels: readonly DetectionLabel[]
  apiBaseUrl: string
  onOpenMedia: (type: 'image' | 'video', url: string) => void
  /** What the screen adds to a row - the identity correction, on the history only. */
  renderExtra?: (event: DetectionEvent) => ReactNode
}

/**
 * The detection list, the same on the home screen and in the history: home is only the latest
 * of them. Two separate renderings had drifted, one keeping the thumbnail the other had lost.
 */
export function DetectionList({
  events,
  labels,
  apiBaseUrl,
  onOpenMedia,
  renderExtra,
}: DetectionListProps) {
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => (
        <li key={event.eventId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          {/* Un media expire n'est pas une panne : rien a retenter, donc rien a cliquer. */}
          {event.mediaExpired && (
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
            >
              <CalendarOff className="size-4" />
            </span>
          )}

          {event.hasSnapshot && !event.mediaExpired && (
            <button
              type="button"
              aria-label={`Voir l’aperçu — ${formatEventTitle(event, labels)}`}
              className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              // The tile shows the crop, opening shows the wide shot: two images, not two sizes.
              onClick={() => onOpenMedia('image', snapshotUrl(apiBaseUrl, event.eventId))}
            >
              <DetectionThumbnail src={thumbnailUrl(apiBaseUrl, event.eventId)} />
            </button>
          )}

          <span className="min-w-0 flex-1">
            <span className="block font-medium">{formatEventTitle(event, labels)}</span>
            <span className="block text-sm text-muted-foreground">{formatEventDetail(event)}</span>
            {event.mediaExpired && (
              <span className="block text-sm text-muted-foreground">
                Aperçu et vidéo effacés — au-delà de la durée de conservation.
              </span>
            )}
            {renderExtra?.(event)}
          </span>

          {event.hasClip && !event.mediaExpired && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onOpenMedia('video', `${apiBaseUrl}/api/detection-events/${event.eventId}/clip`)
              }
            >
              <Play aria-hidden="true" />
              Vidéo
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}
