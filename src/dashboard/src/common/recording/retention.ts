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
  // Named after its observable effect, not after the Frigate bucket carrying it (ADR-49).
  eventClip: 'Historique de détection',
}

export const RETENTION_EXPLANATION: Record<RetentionWindow, string> = {
  continuous:
    'Tout est enregistré, même quand il ne se passe rien. C’est ce qui occupe de loin le plus d’espace disque.',
  motion: 'Seuls les moments où l’image bouge sont conservés.',
  eventClip:
    'Combien de temps vos détections restent consultables — aperçu et vidéo compris. C’est la profondeur de la page Historique.',
}

// Said in the help of each duration: outside the row it was running text, which is banned (ADR-43).
const RETENTION_ZERO_NOTE = 'Mettre 0 signifie que rien n’est conservé de cette nature.'
const RETENTION_FLOOR_NOTE = 'Au moins un jour : c’est ce que votre historique peut remonter.'

/** The help of a duration, the same at install time and on a camera. */
export function retentionHelp(window: RetentionWindow): string {
  const note = window === 'eventClip' ? RETENTION_FLOOR_NOTE : RETENTION_ZERO_NOTE
  return `${RETENTION_EXPLANATION[window]} ${note}`
}

/** The floor of a duration: only the one carrying the history has one (ADR-48). */
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
