import type { NotificationSummary } from '../../domain/entities/NotificationSummary'

// What a detection says about itself is formatted in `common/detection/detectionFormatters`,
// home and history showing the same list.

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatLastNotification(value: string | null): string {
  if (!value) {
    return 'Aucune alerte envoyee'
  }

  return `Envoyee a ${timeFormatter.format(new Date(value))}`
}

export function formatNotificationStatus(summary: NotificationSummary): string {
  return summary.activeChannels > 0 ? 'Alertes actives' : 'Aucun canal d’alerte'
}
