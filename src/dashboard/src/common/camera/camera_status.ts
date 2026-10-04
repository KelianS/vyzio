import type { BadgeTone } from '../components/badge'
import { CameraState, CameraValidation, type Camera } from '../../domain/entities/camera.entity'

/** The camera's own status, in the words of the camera list, its page header and its hub tile. */
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
    case CameraState.ToSetUp:
      return 'À configurer'
    default:
      return 'À vérifier'
  }
}

/** A camera to set up is not a fault: neutral, whatever the backend's attention flag says (DESIGN SYSTEM § Capabilities). */
export function formatStatusTone(camera: Camera): BadgeTone {
  switch (camera.status) {
    case CameraState.ToSetUp:
      return 'neutral'
    case CameraState.Offline:
      return 'danger'
    case CameraState.Online:
      return camera.needsAttention ? 'warn' : 'ok'
    default:
      return 'warn'
  }
}

/** Whether the camera is watched yet, and what it waits for otherwise (ADR-68 d). */
export const SurveillanceEntry = {
  Watched: 'watched',
  /** Its stream never worked: the way forward is its Connexion tab. */
  AwaitsStream: 'awaits_stream',
  /** Its stream works, surveillance has not taken it in: the way forward is the restart trigger. */
  AwaitsRestart: 'awaits_restart',
} as const

export type SurveillanceEntry = (typeof SurveillanceEntry)[keyof typeof SurveillanceEntry]

export function surveillanceEntryOf(camera: Pick<Camera, 'validationState'>): SurveillanceEntry {
  switch (camera.validationState) {
    case CameraValidation.ToSetUp:
      return SurveillanceEntry.AwaitsStream
    case CameraValidation.Draft:
      return SurveillanceEntry.AwaitsRestart
    // Leaving surveillance at the next restart, it is still watched until then.
    case CameraValidation.PendingRemoval:
    case CameraValidation.Validated:
    default:
      return SurveillanceEntry.Watched
  }
}
