import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { NotificationSummary } from '../../domain/entities/NotificationSummary'
import type { Profile } from '../../domain/entities/Profile'

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatEventTime(value: string): string {
  return timeFormatter.format(new Date(value))
}

export function formatEventTitle(event: DetectionEvent): string {
  if (event.identity) {
    return `${event.identity} detectee`
  }

  return `Detection ${event.label}`
}

export function formatEventDetail(event: DetectionEvent): string {
  return event.camera.replaceAll('_', ' ')
}

export function getEventTone(event: DetectionEvent): 'high' | 'ok' | 'normal' {
  if (event.identity || event.label.toLowerCase() === 'person') {
    return 'high'
  }

  if (event.lifecycle.toLowerCase() === 'end') {
    return 'ok'
  }

  return 'normal'
}

export function formatProfileMeta(profile: Profile): string {
  return `${profile.category} · ${profile.alertMode}`
}

export function formatLastSeen(value: string | null): string {
  if (!value) {
    return 'Pas encore vu'
  }

  return `Vu a ${timeFormatter.format(new Date(value))}`
}

export function formatLastNotification(value: string | null): string {
  if (!value) {
    return 'Aucune alerte envoyee'
  }

  return `Envoyee a ${timeFormatter.format(new Date(value))}`
}

export function formatNotificationStatus(summary: NotificationSummary): string {
  return summary.telegramConfigured ? 'Telegram actif' : 'Telegram a configurer'
}
