import type { BadgeTone } from '../components/badge'
import { scrubSecrets } from '../errors/scrub_secrets'
import {
  CameraState,
  PrivacyMiss,
  PrivacyStrategy,
  type Camera,
} from '../../domain/entities/camera.entity'

type PrivacyAnswer = Pick<Camera, 'privacyMiss' | 'privacyModeActive' | 'privacyStrategy'>

interface PrivacyBadge {
  readonly text: string
  readonly tone: BadgeTone
  /** Which icon the surface draws, through PrivacyStateIcon. */
  readonly kind: PrivacyBadgeKind
}

export type PrivacyBadgeKind = 'cut' | 'off'

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

/** The consequence in one line; null when nothing missed or the strategy asked nothing of the camera. */
function privacyMissLabel(camera: PrivacyAnswer): string | null {
  if (camera.privacyMiss === null || !ASKS_THE_CAMERA[camera.privacyStrategy]) return null
  const label = MISSED_LABEL[camera.privacyStrategy]
  if (!label) return null
  // An interrupted request says nothing about the camera: it may have followed.
  if (!DID_NOT_FOLLOW[camera.privacyMiss])
    return camera.privacyModeActive ? label.unsureOn : label.unsureOff
  return camera.privacyModeActive ? label.on : label.off
}

/** What is missing when the camera could not even be asked; null when asking again is the fix. */
function missingPart(camera: PrivacyAnswer): string | null {
  switch (camera.privacyMiss) {
    case PrivacyMiss.PositionMissing:
      return camera.privacyModeActive
        ? 'sa position Parking n’est pas enregistrée'
        : 'sa position Surveillance n’est pas enregistrée'
    case PrivacyMiss.CapabilityUnverified:
      return camera.privacyStrategy === PrivacyStrategy.Hardware
        ? 'sa coupure matérielle n’est pas vérifiée'
        : 'son orientation n’est pas vérifiée'
    case PrivacyMiss.CameraFailed:
    case PrivacyMiss.Unconfirmed:
    case null:
      return null
    default: {
      const unknown: never = camera.privacyMiss
      return unknown
    }
  }
}

type MissedCamera = PrivacyAnswer &
  Pick<Camera, 'id' | 'displayName' | 'status' | 'privacyMissDetail'>

/** A miss worth telling, in one line with its diagnostic (PRIV-05). */
export interface PrivacyMissNotice {
  /** Stable while this miss lasts, so the bar forgets it once it is told or ends. */
  readonly key: string
  /** The camera and the consequence: « Salon : la caméra ne s’est pas tournée ». */
  readonly title: string
  /** What is missing, when asking the camera again cannot fix it. */
  readonly missing: string | null
  /** Asking the camera again is the fix: it did not follow, or never answered. */
  readonly retry: boolean
  readonly diagnostic: string | null
}

/** The miss to tell; null when there is none, or when the camera is offline and its own alert says it. */
export function privacyMissNotice(camera: MissedCamera): PrivacyMissNotice | null {
  const label = privacyMissLabel(camera)
  // An offline camera is not expected to follow: « ne répond plus » already says all (PRIV-05).
  if (label === null || camera.status === CameraState.Offline) return null
  const missing = missingPart(camera)
  return {
    key: `privacy-miss:${camera.id}:${camera.privacyModeActive ? 'on' : 'off'}:${camera.privacyMiss}`,
    title: `${camera.displayName} : ${label.charAt(0).toLowerCase()}${label.slice(1)}`,
    missing,
    retry: missing === null,
    diagnostic: camera.privacyMissDetail ? scrubSecrets(camera.privacyMissDetail) : null,
  }
}

/** What the camera answered, never what its strategy promises (PRIV-04); null while privacy is off or a miss speaks. */
export function privacyBadge(
  camera: PrivacyAnswer & Pick<Camera, 'privacyVendorCut'>,
): PrivacyBadge | null {
  if (camera.privacyVendorCut)
    return { text: 'Coupure matérielle confirmée', tone: 'ok', kind: 'cut' }
  if (!camera.privacyModeActive) return null
  // A miss is told apart, never as a badge (privacyMissNotice).
  if (camera.privacyMiss !== null && ASKS_THE_CAMERA[camera.privacyStrategy]) return null
  return FOLLOWED[camera.privacyStrategy]
}
