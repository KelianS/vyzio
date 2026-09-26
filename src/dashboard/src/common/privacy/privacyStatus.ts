import type { BadgeTone } from '../components/Badge'
import { PrivacyMiss, PrivacyStrategy, type Camera } from '../../domain/entities/Camera'

type PrivacyAnswer = Pick<Camera, 'privacyMiss' | 'privacyModeActive' | 'privacyStrategy'>

interface PrivacyBadge {
  readonly text: string
  readonly icon: string
  readonly tone: BadgeTone
}

const RECORDING_OFF: PrivacyBadge = {
  text: 'Enregistrement désactivé',
  icon: '🔇',
  tone: 'neutral',
}

const SAVE_POSITIONS = 'Enregistrez-la dans « Image et pilotage ».'
const CHECK_CAMERA = 'Vérifiez qu’elle est allumée et connectée.'
const STILL_FILMING = 'elle filme peut-être encore, mais Vyzio n’enregistre plus rien.'

/** A miss Vyzio knows about: the camera refused, was not reachable or was not set up; not an unknown answer. */
const cameraDidNotFollow = (miss: PrivacyMiss | null): boolean =>
  miss !== null && miss !== PrivacyMiss.Unconfirmed

/** The short line a camera tile shows, pointing at the screen that explains it (SPECS 9.2). */
export const privacyMissLabel = (miss: PrivacyMiss): string =>
  cameraDidNotFollow(miss) ? 'La caméra n’a pas suivi' : 'Réponse de la caméra non reçue'

/** What the camera answered, never what its strategy promises (SPECS 9.2); null while privacy is off. */
export function privacyBadge(
  camera: PrivacyAnswer & Pick<Camera, 'privacyVendorCut'>,
): PrivacyBadge | null {
  if (camera.privacyVendorCut)
    return { text: 'Coupure matérielle confirmée', icon: '🔒', tone: 'ok' }
  if (!camera.privacyModeActive) return null
  if (cameraDidNotFollow(camera.privacyMiss))
    return { text: 'La caméra n’a pas suivi, enregistrement désactivé', icon: '⚠️', tone: 'warn' }
  switch (camera.privacyStrategy) {
    case PrivacyStrategy.PtzParking:
      // An unconfirmed move claims nothing: the camera may not have turned.
      return camera.privacyMiss === null
        ? { text: 'Caméra orientée, enregistrement désactivé', icon: '🔇', tone: 'neutral' }
        : RECORDING_OFF
    default:
      return RECORDING_OFF
  }
}

// Only the strategies that ask something of the camera can miss; the others never reach here.
function unverifiedSentence(strategy: PrivacyStrategy): string {
  switch (strategy) {
    case PrivacyStrategy.Hardware:
      return 'La coupure matérielle de cette caméra n’est pas vérifiée : seul l’enregistrement est coupé.'
    default:
      return 'L’orientation de cette caméra n’est pas vérifiée : elle n’a pas bougé, seul l’enregistrement est coupé.'
  }
}

function refusedOnSentence(strategy: PrivacyStrategy): string {
  switch (strategy) {
    case PrivacyStrategy.Hardware:
      return `La caméra n’a pas coupé son objectif : ${STILL_FILMING} ${CHECK_CAMERA}`
    default:
      return `La caméra ne s’est pas tournée vers sa position Parking : ${STILL_FILMING} ${CHECK_CAMERA}`
  }
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
      return unverifiedSentence(camera.privacyStrategy)
    case PrivacyMiss.CameraFailed:
      return on
        ? refusedOnSentence(camera.privacyStrategy)
        : `La caméra n’est pas revenue sur sa position Surveillance : l’enregistrement a repris sur ce qu’elle voit maintenant. ${CHECK_CAMERA}`
    case PrivacyMiss.Unconfirmed:
      return on
        ? 'La demande a été interrompue avant la réponse de la caméra : Vyzio ne sait pas si elle a suivi. L’enregistrement est bien coupé.'
        : 'La demande a été interrompue avant la réponse de la caméra : Vyzio ne sait pas si elle est revenue sur sa position Surveillance.'
  }
}
