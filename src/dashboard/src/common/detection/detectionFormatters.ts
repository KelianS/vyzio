import type { DetectionEvent } from '../../domain/entities/DetectionEvent'

// Only these detections carry an identity: the backend resolves them to person_known/person_unknown,
// and gives one to no other kind. Attaching a profile to a cat produces unusable data.
const IDENTITY_LABELS: ReadonlySet<string> = new Set(['person', 'face'])

export function carriesIdentity(event: DetectionEvent): boolean {
  return IDENTITY_LABELS.has(event.label.toLowerCase())
}

/** The full frame: what one opens, never what a 56px tile shows. */
export function snapshotUrl(apiBaseUrl: string, eventId: string): string {
  return `${apiBaseUrl}/api/detection-events/${eventId}/snapshot`
}

/** The crop around the object, already written by Frigate: 175x175, fifteen times lighter. */
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

/** Today, the time is enough; beyond that, the date places it. */
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

/** Where, when, and how sure - the certainty only shows when the engine gave one. */
export function formatEventDetail(event: DetectionEvent): string {
  return [
    event.cameraName,
    formatEventTime(event.occurredAt),
    event.confidence !== null ? `${Math.round(event.confidence * 100)} % de certitude` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
