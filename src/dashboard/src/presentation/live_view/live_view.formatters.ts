import { PRESET_LABELS, type PtzPreset } from '../../domain/entities/ptz_preset.entity'

/** Said without a picture, whether the stream refused or the address reached a camera in privacy mode. */
export const PRIVACY_STOPS_LIVE = 'Mode vie privée : la vue en direct est arrêtée.'
export const CAMERA_REMOVED = 'Cette caméra n’existe plus.'

/** A position's name: the one saved on the camera, else the reserved one, else its number. */
export function presetLabel(presets: PtzPreset[], presetId: number): string {
  return (
    presets.find((p) => p.presetId === presetId)?.label ??
    PRESET_LABELS[presetId] ??
    `Position ${presetId}`
  )
}
