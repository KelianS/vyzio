import type { NotificationSummary } from '../../domain/entities/NotificationSummary'
import type { Profile } from '../../domain/entities/Profile'

// Ce qu'une detection dit d'elle-meme se formate dans `common/detection/detectionFormatters`,
// l'accueil et l'historique montrant la meme liste.

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
  return summary.telegramConfigured ? 'Telegram actif' : 'Telegram a configurer'
}
