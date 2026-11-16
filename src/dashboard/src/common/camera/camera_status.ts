import { CameraState, CameraValidation, type Camera } from '../../domain/entities/camera.entity'
import { StatusMarkKind, type StatusMarkState } from '../components/status_mark_state'

type CameraStatusFacts = Pick<
  Camera,
  'status' | 'validationState' | 'privacyModeActive' | 'connected'
>

const TO_SET_UP: StatusMarkState = { kind: StatusMarkKind.Off, label: 'À configurer' }

/** A camera's mark (UI-31): one not in surveillance yet or cut does not film; a trouble is the ring. */
export function cameraMark(camera: CameraStatusFacts): StatusMarkState {
  // Neither a camera to set up nor one waiting for the restart is watched yet (ADR-04).
  if (surveillanceEntryOf(camera) !== SurveillanceEntry.Watched) return TO_SET_UP
  if (camera.privacyModeActive) return { kind: StatusMarkKind.Off, label: 'Coupée' }
  // Its stream never worked: not a camera that stopped answering.
  if (camera.status === CameraState.ToSetUp) return TO_SET_UP
  if (!camera.connected) return { kind: StatusMarkKind.Alert, label: 'Hors ligne' }
  switch (camera.status) {
    case CameraState.Online:
      return { kind: StatusMarkKind.On, label: 'En marche' }
    case CameraState.Offline:
      return { kind: StatusMarkKind.Alert, label: 'Hors ligne' }
    case CameraState.Degraded:
      return { kind: StatusMarkKind.Alert, label: 'Dégradée' }
    case CameraState.ConfigError:
      return { kind: StatusMarkKind.Alert, label: 'Erreur de configuration' }
    default:
      return { kind: StatusMarkKind.Off, label: 'À vérifier' }
  }
}

/** Whether the camera is watched yet, and what it waits for otherwise (ADR-04). */
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
