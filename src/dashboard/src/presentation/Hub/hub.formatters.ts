import type { NotificationSummary } from '../../domain/entities/NotificationSummary'
import type { Profile } from '../../domain/entities/Profile'

// What a detection says about itself is formatted in `common/detection/detectionFormatters`,
// home and history showing the same list.

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

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
  return summary.activeChannels > 0 ? 'Alertes actives' : 'Aucun canal d’alerte'
}
