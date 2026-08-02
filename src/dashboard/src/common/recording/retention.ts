// Shared vocabulary for the three retention windows (ADR-39). Frigate's own words — continuous,
// motion, alerts/detections — never surface: the user is told what is kept, not which bucket holds
// it (principe produit #1 et #2).

import type { CameraRetention } from '../../domain/entities/DetectionConfig'


export type RetentionWindow = 'continuous' | 'motion' | 'eventClip'

export const RETENTION_ORDER: RetentionWindow[] = ['continuous', 'motion', 'eventClip']

// The override keys are spelled the same on CameraRetention and on DetectionConfigUpdate, so one
// map serves reading the current state and building the save.
export const RETENTION_OVERRIDE_FIELD = {
  continuous: 'continuousDaysOverride',
  motion: 'motionDaysOverride',
  eventClip: 'eventClipDaysOverride',
} as const satisfies Record<RetentionWindow, keyof CameraRetention>

export const RETENTION_EFFECTIVE_FIELD = {
  continuous: 'effectiveContinuousDays',
  motion: 'effectiveMotionDays',
  eventClip: 'effectiveEventClipDays',
} as const satisfies Record<RetentionWindow, keyof CameraRetention>

// A camera is on its own as soon as it overrides any one window.
export function hasAnyOverride(retention: CameraRetention): boolean {
  return RETENTION_ORDER.some((window) => retention[RETENTION_OVERRIDE_FIELD[window]] !== null)
}

export const RETENTION_LABEL: Record<RetentionWindow, string> = {
  continuous: 'Vidéo complète',
  motion: 'Séquences de mouvement',
  eventClip: 'Clips d’alerte',
}

export const RETENTION_EXPLANATION: Record<RetentionWindow, string> = {
  continuous:
    'Tout est enregistré, même quand il ne se passe rien. C’est ce qui occupe de loin le plus d’espace disque.',
  motion: 'Seuls les moments où l’image bouge sont conservés.',
  eventClip: 'Les extraits rattachés à une détection — ceux que vous retrouvez dans l’historique.',
}

// Zero is a real answer, so it gets words rather than a bare "0 jour".
export function formatDays(days: number): string {
  if (days <= 0) return 'non conservé'
  return days === 1 ? '1 jour' : `${days} jours`
}

// The order of magnitude ADR-18 requires to be shown before switching full-video recording on.
export const CONTINUOUS_DISK_WARNING =
  'Compter environ 1 à 3 Go par jour et par caméra pour la vidéo complète.'
