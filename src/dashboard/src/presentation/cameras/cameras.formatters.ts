import type { BadgeTone } from '../../common/components/badge'
import { CameraState, type Camera } from '../../domain/entities/camera.entity'
import type { Capability } from '../../domain/entities/camera_capability_binding.entity'

/** Plain names, the words the rest of the product uses for each capability (DESIGN SYSTEM § Capabilities). */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  stream: 'Flux vidéo',
  ptz: 'Orientation',
  hardware_privacy: 'Coupure matérielle',
  image_settings: 'Réglages image',
}

/** The video stream, the capability every other one depends on. */
export const STREAM_LABEL = CAPABILITY_LABELS.stream

/** The way out of a stream that does not answer, wherever it is said: both places it can be fixed (DESIGN SYSTEM § Capability cards). */
export const STREAM_REPAIR =
  'vérifiez l’adresse et le compte de la caméra dans Avancé, puis les options du flux vidéo.'

/** A removal button drawn in outline, so it reads as destructive without shouting. */
export const DESTRUCTIVE_OUTLINE = 'border-destructive text-destructive hover:bg-destructive/10'

/** Why a capability test cannot run, next to every button it greys out (SPECS 2.2). */
export const TESTS_SUSPENDED = 'Les autres capacités se vérifient une fois le flux vidéo rétabli.'

// What went wrong for each camera status that is not online, and the way out (SPECS 1.5).
const STREAM_FAILURE_LINES: Record<string, string> = {
  [CameraState.Offline]: `Vyzio ne reçoit pas les images : ${STREAM_REPAIR}`,
  [CameraState.Degraded]:
    'La caméra répond, mais son image n’arrive pas : vérifiez le compte de la caméra dans Avancé, puis les options du flux vidéo.',
  [CameraState.ConfigError]: 'Vyzio n’a pas pu préparer la surveillance de cette caméra.',
}

/** The state line of the stream card; a status with no failure line of its own has not been checked since it changed. */
export function formatStreamStateLine(camera: Camera): string {
  if (camera.connected) {
    return camera.lastSuccessfulFrameAt
      ? `Dernière image confirmée le ${formatCheckedAt(camera.lastSuccessfulFrameAt)}`
      : 'La caméra répond.'
  }
  return (
    STREAM_FAILURE_LINES[camera.status] ??
    'Pas encore vérifié : lancez « Vérifier » pour confirmer que Vyzio reçoit les images.'
  )
}

export function formatCheckedAt(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** One read, one sentence: the saved positions, wherever their read fails. */
export const POSITIONS_UNREAD = 'Les positions de cette caméra n’ont pas pu être lues.'

export function formatCameraStatusLabel(status: string): string {
  switch (status) {
    case CameraState.Online:
      return 'Connectée'
    case CameraState.Offline:
      return 'Hors ligne'
    case CameraState.Degraded:
      return 'Dégradée'
    case CameraState.ConfigError:
      return 'Erreur de configuration'
    default:
      return 'À vérifier'
  }
}

export function formatStatusTone(camera: Camera): BadgeTone {
  if (camera.status === CameraState.Online && !camera.needsAttention) return 'ok'
  if (camera.status === CameraState.Offline) return 'danger'
  return 'warn'
}
