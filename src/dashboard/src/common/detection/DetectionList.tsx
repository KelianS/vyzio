import type { ReactNode } from 'react'
import { Play } from 'lucide-react'
import { Button } from '../ui/button'
import { DetectionThumbnail } from '../components/DetectionThumbnail'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import { formatEventDetail, formatEventTitle, snapshotUrl, thumbnailUrl } from './detectionFormatters'

interface DetectionListProps {
  events: DetectionEvent[]
  apiBaseUrl: string
  onOpenMedia: (type: 'image' | 'video', url: string) => void
  /** Ce que l'ecran ajoute a une ligne — la correction d'identite, sur l'historique seulement. */
  renderExtra?: (event: DetectionEvent) => ReactNode
}

/**
 * La liste des detections, la meme a l'accueil et dans l'historique : l'accueil n'en est que les
 * dernieres. Deux rendus separes avaient diverge, l'un gardant la miniature que l'autre avait perdue.
 */
export function DetectionList({
  events,
  apiBaseUrl,
  onOpenMedia,
  renderExtra,
}: DetectionListProps) {
  return (
    <ul className="divide-y divide-border">
      {events.map((event) => (
        <li key={event.eventId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          {event.hasSnapshot && (
            <button
              type="button"
              aria-label={`Voir l’aperçu — ${formatEventTitle(event)}`}
              className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              // La tuile montre le recadrage, l'ouverture montre le plan large : deux images, pas deux tailles.
              onClick={() => onOpenMedia('image', snapshotUrl(apiBaseUrl, event.eventId))}
            >
              <DetectionThumbnail src={thumbnailUrl(apiBaseUrl, event.eventId)} />
            </button>
          )}

          <span className="min-w-0 flex-1">
            <span className="block font-medium">{formatEventTitle(event)}</span>
            <span className="block text-sm text-muted-foreground">{formatEventDetail(event)}</span>
            {renderExtra?.(event)}
          </span>

          {event.hasClip && (
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
