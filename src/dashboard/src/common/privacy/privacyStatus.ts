import type { BadgeTone } from '../components/Badge'
import { PrivacyMiss, PrivacyStrategy, type Camera } from '../../domain/entities/Camera'

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

const RECORDING_OFF: PrivacyBadge = {
  text: 'Enregistrement désactivé',
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
  [PrivacyStrategy.None]: false,
  [PrivacyStrategy.SoftwareBlur]: false,
  [PrivacyStrategy.PtzParking]: true,
  [PrivacyStrategy.Hardware]: true,
}

/** What an accepted request did, per strategy; a strategy that asks nothing of the camera claims nothing. */
const FOLLOWED: Record<PrivacyStrategy, PrivacyBadge> = {
  [PrivacyStrategy.None]: RECORDING_OFF,
  [PrivacyStrategy.SoftwareBlur]: RECORDING_OFF,
  [PrivacyStrategy.PtzParking]: {
    text: 'Caméra orientée, enregistrement désactivé',
    tone: 'neutral',
    kind: 'off',
  },
  // A confirmed cut is carried by privacyVendorCut; without it the lens was not confirmed shut.
  [PrivacyStrategy.Hardware]: RECORDING_OFF,
}

/** What did not happen, named per strategy rather than as a vague miss; null where nothing is asked of the camera. */
const MISSED_BADGE: Record<PrivacyStrategy, string | null> = {
  [PrivacyStrategy.None]: null,
  [PrivacyStrategy.SoftwareBlur]: null,
  [PrivacyStrategy.PtzParking]: 'Caméra non tournée, enregistrement désactivé',
  [PrivacyStrategy.Hardware]: 'Objectif non coupé, enregistrement désactivé',
}

const MISSED_LABEL: Record<PrivacyStrategy, { on: string; off: string } | null> = {
  [PrivacyStrategy.None]: null,
  [PrivacyStrategy.SoftwareBlur]: null,
  [PrivacyStrategy.PtzParking]: {
    on: 'La caméra ne s’est pas tournée',
    off: 'La caméra n’est pas revenue',
  },
  [PrivacyStrategy.Hardware]: {
    on: 'L’objectif ne s’est pas coupé',
    off: 'L’objectif ne s’est pas rouvert',
  },
}

/** The sentence per strategy; the ones that ask nothing of the camera are stopped by ASKS_THE_CAMERA first. */
const UNVERIFIED: Record<PrivacyStrategy, string | null> = {
  [PrivacyStrategy.None]: null,
  [PrivacyStrategy.SoftwareBlur]: null,
  [PrivacyStrategy.PtzParking]:
    'L’orientation de cette caméra n’est pas vérifiée : elle n’a pas bougé, seul l’enregistrement est coupé.',
  [PrivacyStrategy.Hardware]:
    'La coupure matérielle de cette caméra n’est pas vérifiée : seul l’enregistrement est coupé.',
}

const REFUSED_ON: Record<PrivacyStrategy, string | null> = {
  [PrivacyStrategy.None]: null,
  [PrivacyStrategy.SoftwareBlur]: null,
  [PrivacyStrategy.PtzParking]: `La caméra ne s’est pas tournée vers sa position Parking : ${STILL_FILMING} ${CHECK_CAMERA}`,
  [PrivacyStrategy.Hardware]: `La caméra n’a pas coupé son objectif : ${STILL_FILMING} ${CHECK_CAMERA}`,
}

/** The short line a camera tile shows, pointing at the screen that explains it (SPECS 9.2); null when nothing missed. */
export function privacyMissLabel(camera: PrivacyAnswer): string | null {
  if (camera.privacyMiss === null || !ASKS_THE_CAMERA[camera.privacyStrategy]) return null
  if (!DID_NOT_FOLLOW[camera.privacyMiss]) return 'Demande interrompue'
  const label = MISSED_LABEL[camera.privacyStrategy]
  return label && (camera.privacyModeActive ? label.on : label.off)
}

/** What the camera answered, never what its strategy promises (SPECS 9.2); null while privacy is off. */
export function privacyBadge(
  camera: PrivacyAnswer & Pick<Camera, 'privacyVendorCut'>,
): PrivacyBadge | null {
  if (camera.privacyVendorCut)
    return { text: 'Coupure matérielle confirmée', tone: 'ok', kind: 'cut' }
  if (!camera.privacyModeActive) return null
  if (camera.privacyMiss === null || !ASKS_THE_CAMERA[camera.privacyStrategy])
    return FOLLOWED[camera.privacyStrategy]
  const missed = MISSED_BADGE[camera.privacyStrategy]
  return DID_NOT_FOLLOW[camera.privacyMiss] && missed
    ? { text: missed, tone: 'warn', kind: 'missed' }
    : RECORDING_OFF
}

/** What happened and what to do, for the camera's privacy screen (SPECS 1.5, 9.2); null when it followed. */
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
