import { formatEventTime } from '../../common/detection/detection_formatters'
import type { NotificationSummary } from '../../domain/entities/notification_summary.entity'

/** The hub's one line on alerts: whether Vyzio can warn you, then what it sent. */
export function alertsSummary(notifications: NotificationSummary): string {
  if (notifications.activeChannels === 0)
    return 'Aucun canal configuré : Vyzio ne peut pas vous notifier.'
  if (notifications.sentCount === 0) return 'Aucune notification envoyée pour l’instant.'
  const sent = `${notifications.sentCount} envoyée${notifications.sentCount > 1 ? 's' : ''}`
  return notifications.lastSentAt
    ? `${sent} · dernière à ${formatEventTime(notifications.lastSentAt)}`
    : sent
}
