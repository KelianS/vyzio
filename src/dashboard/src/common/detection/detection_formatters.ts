import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'

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

/** The detection's video, played in place of a picture. */
export function clipUrl(apiBaseUrl: string, eventId: string): string {
  return `${apiBaseUrl}/api/detection-events/${encodeURIComponent(eventId)}/clip`
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
function formatEventTime(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  return isToday ? timeFormatter.format(date) : dateTimeFormatter.format(date)
}

/** The labels are the server's catalogue, the one home of their French names; an unknown one shows as sent. */
export function formatEventTitle(event: DetectionEvent, labels: readonly DetectionLabel[]): string {
  // The name alone: a participle would need the person's gender, which Vyzio does not hold.
  if (event.identity) {
    return event.identity
  }

  const name = labels.find((label) => label.value === event.label)?.displayName ?? event.label
  return `Détection « ${name} »`
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

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** "Aujourd’hui", "Hier", then the day itself: the label a group of clips sits under. */
export function formatClipDay(occurredAt: string, now: Date): string {
  const date = new Date(occurredAt)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(date) === dayKey(now)) return 'Aujourd’hui'
  if (dayKey(date) === dayKey(yesterday)) return 'Hier'
  const day = dayFormatter.format(date)
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/** A clip's line under its name: its hour, and how sure the engine was when it said. */
export function formatClipDetail(event: DetectionEvent): string {
  const date = new Date(event.occurredAt)
  const minutes = date.getMinutes()
  const hour = `${date.getHours()} h${minutes === 0 ? '' : ` ${String(minutes).padStart(2, '0')}`}`
  return event.confidence !== null
    ? `${hour} · sûr à ${Math.round(event.confidence * 100)} %`
    : hour
}

/** The clips in the order given, gathered under the day each happened. */
export function groupClipsByDay(
  events: readonly DetectionEvent[],
  now: Date,
): { day: string; events: DetectionEvent[] }[] {
  const groups: { day: string; events: DetectionEvent[] }[] = []
  for (const event of events) {
    const day = formatClipDay(event.occurredAt, now)
    const last = groups.at(-1)
    if (last?.day === day) last.events.push(event)
    else groups.push({ day, events: [event] })
  }
  return groups
}
