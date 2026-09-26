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

/** Only the strategies that ask something of the camera can miss; a stale miss under another says nothing. */
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

/** The short line a camera tile shows, pointing at the screen that explains it (SPECS 9.2). */
export const privacyMissLabel = (miss: PrivacyMiss): string =>
  DID_NOT_FOLLOW[miss] ? 'La caméra n’a pas suivi' : 'Demande interrompue'

/** What the camera answered, never what its strategy promises (SPECS 9.2); null while privacy is off. */
export function privacyBadge(
  camera: PrivacyAnswer & Pick<Camera, 'privacyVendorCut'>,
): PrivacyBadge | null {
  if (camera.privacyVendorCut)
    return { text: 'Coupure matérielle confirmée', tone: 'ok', kind: 'cut' }
  if (!camera.privacyModeActive) return null
  if (camera.privacyMiss === null) return FOLLOWED[camera.privacyStrategy]
  return DID_NOT_FOLLOW[camera.privacyMiss]
    ? { text: 'La caméra n’a pas suivi, enregistrement désactivé', tone: 'warn', kind: 'missed' }
    : RECORDING_OFF
}

/** What happened and what to do, for the camera's privacy screen (SPECS 1.5, 9.2); null when it followed. */
export function privacyMissSentence(camera: PrivacyAnswer): string | null {
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
