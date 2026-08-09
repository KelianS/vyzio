// Shared vocabulary for the three retention windows (ADR-39). Frigate's own words — continuous,
// motion, alerts/detections — never surface: the user is told what is kept, not which bucket holds
// it (principes produit #1 et #2).

import type { CameraRetention, DetectionConfigUpdate } from '../../domain/entities/DetectionConfig'

// Keyed to match CameraRetention, so a window indexes its values directly with no lookup table.
export type RetentionWindow = keyof Omit<CameraRetention, 'maxDays' | 'minEventClipDays'>

export const RETENTION_ORDER: RetentionWindow[] = ['continuous', 'motion', 'eventClip']

// The save request stays flat, so this is the one place the two shapes are bridged.
export const RETENTION_UPDATE_FIELD = {
  continuous: 'continuousDaysOverride',
  motion: 'motionDaysOverride',
  eventClip: 'eventClipDaysOverride',
} as const satisfies Record<RetentionWindow, keyof DetectionConfigUpdate>

export const RETENTION_LABEL: Record<RetentionWindow, string> = {
  continuous: 'Vidéo complète',
  motion: 'Séquences de mouvement',
  // Nommee par son effet observable, pas par le bucket Frigate qui la porte (ADR-49).
  eventClip: 'Historique de détection',
}

export const RETENTION_EXPLANATION: Record<RetentionWindow, string> = {
  continuous:
    'Tout est enregistré, même quand il ne se passe rien. C’est ce qui occupe de loin le plus d’espace disque.',
  motion: 'Seuls les moments où l’image bouge sont conservés.',
  eventClip:
    'Combien de temps vos détections restent consultables — aperçu et vidéo compris. C’est la profondeur de la page Historique.',
}

// Se dit dans l'aide de chaque duree : hors de la ligne, c'etait du texte courant, proscrit (ADR-43).
const RETENTION_ZERO_NOTE = 'Mettre 0 signifie que rien n’est conservé de cette nature.'
const RETENTION_FLOOR_NOTE = 'Au moins un jour : c’est ce que votre historique peut remonter.'

/** L'aide d'une duree, la meme a l'installation et sur une camera. */
export function retentionHelp(window: RetentionWindow): string {
  const note = window === 'eventClip' ? RETENTION_FLOOR_NOTE : RETENTION_ZERO_NOTE
  return `${RETENTION_EXPLANATION[window]} ${note}`
}

/** Le plancher d'une duree : seule celle qui porte l'historique en a un (ADR-48). */
export function retentionMinDays(window: RetentionWindow, minEventClipDays: number): number {
  return window === 'eventClip' ? minEventClipDays : 0
}

// Zero is a real answer, so it gets words rather than a bare "0 jour".
export function formatDays(days: number): string {
  if (days <= 0) return 'non conservé'
  return days === 1 ? '1 jour' : `${days} jours`
}

// The order of magnitude ADR-18 requires to be shown before switching full-video recording on.
export const CONTINUOUS_DISK_WARNING =
  'Compter environ 1 à 3 Go par jour et par caméra pour la vidéo complète.'
