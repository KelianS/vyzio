import { formatEventTime } from '../../common/detection/detectionFormatters'
import type { NotificationSummary } from '../../domain/entities/NotificationSummary'

/** The hub's one line on alerts: whether Vyzio can warn you, then what it sent. */
export function alertsSummary(notifications: NotificationSummary): string {
  if (notifications.activeChannels === 0)
    return 'Aucun canal configuré : Vyzio ne peut pas vous prévenir.'
  if (notifications.sentCount === 0) return 'Aucune alerte envoyée pour l’instant.'
  const sent = `${notifications.sentCount} envoyée${notifications.sentCount > 1 ? 's' : ''}`
  return notifications.lastSentAt
    ? `${sent} · dernière à ${formatEventTime(notifications.lastSentAt)}`
    : sent
}
