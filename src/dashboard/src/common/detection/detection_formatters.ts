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

/** The labels are the server's catalogue, the one home of their French names; an unknown one shows as sent. */
export function formatEventTitle(event: DetectionEvent, labels: readonly DetectionLabel[]): string {
  // The name alone: a participle would need the person's gender, which Vyzio does not hold.
  if (event.identity) {
    return event.identity
  }

  const name = labels.find((label) => label.value === event.label)?.displayName ?? event.label
  return `Détection « ${name} »`
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

const NBSP = '\u00a0'

/**
 * A clip's line under its name, the same on every screen: its camera when the list mixes them, its
 * hour, and how sure the engine was when it said.
 */
export function formatClipDetail(event: DetectionEvent, withCamera = false): string {
  const date = new Date(event.occurredAt)
  const minutes = date.getMinutes()
  // Non-breaking inside each part: a narrow row wraps between them, never inside « 92 % ».
  const hour = [date.getHours(), 'h', minutes === 0 ? null : String(minutes).padStart(2, '0')]
    .filter((part) => part !== null)
    .join(NBSP)
  return [
    withCamera ? event.cameraName : null,
    hour,
    event.confidence !== null
      ? ['sûr', 'à', Math.round(event.confidence * 100), '%'].join(NBSP)
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The name a downloaded clip is saved under: its camera and its moment, readable in a file list. */
export function clipFileName(event: DetectionEvent): string {
  const date = new Date(event.occurredAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  const moment = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}h${pad(date.getMinutes())}`
  return `${event.cameraName} ${moment}.mp4`
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
