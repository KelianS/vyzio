import type { DetectionEvent } from '../../domain/entities/DetectionEvent'

// Seules ces detections portent une identite : le backend les resout en person_known/person_unknown,
// et n'en attribue a aucune autre. Attribuer un profil a un chat produit une donnee inexploitable.
const IDENTITY_LABELS: ReadonlySet<string> = new Set(['person', 'face'])

export function carriesIdentity(event: DetectionEvent): boolean {
  return IDENTITY_LABELS.has(event.label.toLowerCase())
}

/** L'image plein cadre : ce qu'on ouvre, jamais ce qu'on affiche dans une tuile de 56 px. */
export function snapshotUrl(apiBaseUrl: string, eventId: string): string {
  return `${apiBaseUrl}/api/detection-events/${eventId}/snapshot`
}

/** Le recadrage sur l'objet deja ecrit par Frigate : 175x175, quinze fois plus leger. */
export function thumbnailUrl(apiBaseUrl: string, eventId: string): string {
  return `${apiBaseUrl}/api/detection-events/${eventId}/thumbnail`
}

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Aujourd'hui, l'heure suffit ; au-dela, la date situe. */
export function formatEventTime(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  return isToday ? timeFormatter.format(date) : dateTimeFormatter.format(date)
}

export function formatEventTitle(event: DetectionEvent): string {
  if (event.identity) {
    return `${event.identity} detectee`
  }

  return `Detection '${event.label}'`
}

/** Ou, quand, et avec quelle certitude — la certitude ne se lit que si le moteur en a donne une. */
export function formatEventDetail(event: DetectionEvent): string {
  return [
    event.cameraName,
    formatEventTime(event.occurredAt),
    event.confidence !== null ? `${Math.round(event.confidence * 100)} % de certitude` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
