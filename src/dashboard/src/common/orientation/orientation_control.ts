import type { Camera } from '../../domain/entities/camera.entity'
import type { Capability } from '../../domain/entities/camera_capability_binding.entity'

/** What a camera's Orientation offers outside its card (DESIGN SYSTEM § Capability cards). */
export const OrientationControl = {
  Off: 'off',
  Usable: 'usable',
  Unusable: 'unusable',
} as const

export type OrientationControl = (typeof OrientationControl)[keyof typeof OrientationControl]

/** Whether the camera's head can be driven, so its positions read. */
export const MOVES: Record<OrientationControl, boolean> = {
  off: false,
  usable: true,
  unusable: false,
}

/** The Orientation capability's key, wherever a screen checks it. */
export const ORIENTATION: Capability = 'ptz'

/** Switched off shows nothing; in use, only a verified Orientation moves, as the API refuses any other (ADR-66). */
export function orientationControlOf(camera: Camera): OrientationControl {
  if (!camera.ptzSupported) return OrientationControl.Off
  return camera.verifiedCapabilities.includes(ORIENTATION)
    ? OrientationControl.Usable
    : OrientationControl.Unusable
}
