import type { BadgeTone } from '../components/badge'
import { PrivacyMiss, PrivacyStrategy, type Camera } from '../../domain/entities/camera.entity'

type PrivacyAnswer = Pick<Camera, 'privacyMiss' | 'privacyModeActive' | 'privacyStrategy'>

interface PrivacyBadge {
  readonly text: string
  readonly tone: BadgeTone
  /** Which icon the surface draws, through PrivacyStateIcon. */
  readonly kind: PrivacyBadgeKind
}

export type PrivacyBadgeKind = 'cut' | 'missed' | 'off'

const SAVE_POSITIONS = 'Enregistrez-la dans « Image et pilotage ».'
const CHECK_CAMERA = 'Vérifiez qu’elle est allumée et connectée.'
const STILL_FILMING = 'elle filme peut-être encore, mais Vyzio n’enregistre plus rien.'

/** What still holds while privacy is on, whatever the camera did (ADR-10). */
export const RECORDING_OFF_TEXT = 'Enregistrement désactivé'

const RECORDING_OFF: PrivacyBadge = {
  text: RECORDING_OFF_TEXT,
  tone: 'neutral',
  kind: 'off',
}

/** A miss Vyzio knows about; an interrupted request says nothing about the camera. */
const DID_NOT_FOLLOW: Record<PrivacyMiss, boolean> = {
  [PrivacyMiss.PositionMissing]: true,
  [PrivacyMiss.CapabilityUnverified]: true,
  [PrivacyMiss.CameraFailed]: true,
  [PrivacyMiss.Unconfirmed]: false,
}

/** Whether the strategy asks anything of the camera; a miss left under one that does not is stale and says nothing. */
const ASKS_THE_CAMERA: Record<PrivacyStrategy, boolean> = {
  [PrivacyStrategy.SoftwareBlur]: false,
  [PrivacyStrategy.PtzParking]: true,
  [PrivacyStrategy.Hardware]: true,
}

/** What an accepted request did, per strategy; a strategy that asks nothing of the camera claims nothing. */
const FOLLOWED: Record<PrivacyStrategy, PrivacyBadge> = {
  [PrivacyStrategy.SoftwareBlur]: RECORDING_OFF,
  [PrivacyStrategy.PtzParking]: {
    text: 'Caméra orientée, enregistrement désactivé',
    tone: 'neutral',
    kind: 'off',
  },
  // A confirmed cut is carried by privacyVendorCut; without it the lens was not confirmed shut.
  [PrivacyStrategy.Hardware]: RECORDING_OFF,
}

/** The consequence in plain words, per strategy and direction; "peut-être" when the answer never came. */
const MISSED_LABEL: Record<
  PrivacyStrategy,
  { on: string; off: string; unsureOn: string; unsureOff: string } | null
> = {
  [PrivacyStrategy.SoftwareBlur]: null,
  [PrivacyStrategy.PtzParking]: {
    on: 'La caméra ne s’est pas tournée',
    off: 'La caméra n’a pas repris sa position',
    unsureOn: 'La caméra ne s’est peut-être pas tournée',
    unsureOff: 'La caméra n’a peut-être pas repris sa position',
  },
  [PrivacyStrategy.Hardware]: {
    on: 'L’objectif ne s’est pas coupé',
    off: 'L’objectif ne s’est pas rouvert',
    unsureOn: 'L’objectif ne s’est peut-être pas coupé',
    unsureOff: 'L’objectif ne s’est peut-être pas rouvert',
  },
}

/** The one thing that fixes a miss: ask the camera again, save its positions, or check its capability. */
export type PrivacyMissRemedy = 'retry' | 'positions' | 'connection'

const REMEDY: Record<PrivacyMiss, PrivacyMissRemedy> = {
  [PrivacyMiss.PositionMissing]: 'positions',
  [PrivacyMiss.CapabilityUnverified]: 'connection',
  [PrivacyMiss.CameraFailed]: 'retry',
  [PrivacyMiss.Unconfirmed]: 'retry',
}

/** What fixes the miss the screen shows; null when there is none. */
export function privacyMissRemedy(camera: PrivacyAnswer): PrivacyMissRemedy | null {
  if (camera.privacyMiss === null || !ASKS_THE_CAMERA[camera.privacyStrategy]) return null
  return REMEDY[camera.privacyMiss]
}

/** The sentence per strategy; the ones that ask nothing of the camera are stopped by ASKS_THE_CAMERA first. */
const UNVERIFIED: Record<PrivacyStrategy, string | null> = {
  [PrivacyStrategy.SoftwareBlur]: null,
  [PrivacyStrategy.PtzParking]:
    'L’orientation de cette caméra n’est pas vérifiée : elle n’a pas bougé, seul l’enregistrement est coupé.',
  [PrivacyStrategy.Hardware]:
    'La coupure matérielle de cette caméra n’est pas vérifiée : seul l’enregistrement est coupé.',
}

const REFUSED_ON: Record<PrivacyStrategy, string | null> = {
  [PrivacyStrategy.SoftwareBlur]: null,
  [PrivacyStrategy.PtzParking]: `La caméra ne s’est pas tournée vers sa position Parking : ${STILL_FILMING} ${CHECK_CAMERA}`,
  [PrivacyStrategy.Hardware]: `La caméra n’a pas coupé son objectif : ${STILL_FILMING} ${CHECK_CAMERA}`,
}

/** The short line a camera tile shows, pointing at the screen that explains it (PRIV-05); null when nothing missed. */
export function privacyMissLabel(camera: PrivacyAnswer): string | null {
  if (camera.privacyMiss === null || !ASKS_THE_CAMERA[camera.privacyStrategy]) return null
  const label = MISSED_LABEL[camera.privacyStrategy]
  if (!label) return null
  // An interrupted request says nothing about the camera: it may have followed.
  if (!DID_NOT_FOLLOW[camera.privacyMiss])
    return camera.privacyModeActive ? label.unsureOn : label.unsureOff
  return camera.privacyModeActive ? label.on : label.off
}

/** What the camera answered, never what its strategy promises (PRIV-04); null while privacy is off or a miss speaks. */
export function privacyBadge(
  camera: PrivacyAnswer & Pick<Camera, 'privacyVendorCut'>,
): PrivacyBadge | null {
  if (camera.privacyVendorCut)
    return { text: 'Coupure matérielle confirmée', tone: 'ok', kind: 'cut' }
  if (!camera.privacyModeActive) return null
  // A miss is said by its own line, with what fixes it (privacyMissLabel, privacyMissRemedy).
  if (camera.privacyMiss !== null && ASKS_THE_CAMERA[camera.privacyStrategy]) return null
  return FOLLOWED[camera.privacyStrategy]
}

/** What happened and what to do, for the camera's privacy screen (UI-01, PRIV-05); null when it followed. */
export function privacyMissSentence(camera: PrivacyAnswer): string | null {
  if (!ASKS_THE_CAMERA[camera.privacyStrategy]) return null
  const on = camera.privacyModeActive
  switch (camera.privacyMiss) {
    case null:
      return null
    case PrivacyMiss.PositionMissing:
      return on
        ? `Aucune position Parking n’est enregistrée : la caméra est restée où elle était. ${SAVE_POSITIONS}`
        : `Aucune position Surveillance n’est enregistrée : la caméra n’est pas revenue. ${SAVE_POSITIONS}`
    case PrivacyMiss.CapabilityUnverified:
      return UNVERIFIED[camera.privacyStrategy]
    case PrivacyMiss.CameraFailed:
      return on
        ? REFUSED_ON[camera.privacyStrategy]
        : `La caméra n’est pas revenue sur sa position Surveillance : l’enregistrement a repris sur ce qu’elle voit maintenant. ${CHECK_CAMERA}`
    case PrivacyMiss.Unconfirmed:
      return on
        ? 'La demande a été interrompue avant la réponse de la caméra : Vyzio ne sait pas si elle a suivi. L’enregistrement est bien coupé.'
        : 'La demande a été interrompue avant la réponse de la caméra : Vyzio ne sait pas si elle est revenue sur sa position Surveillance. L’enregistrement a repris.'
    default: {
      const unknown: never = camera.privacyMiss
      return unknown
    }
  }
}
