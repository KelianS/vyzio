import { PRESET_LABELS, type PtzPreset } from '../../domain/entities/ptz_preset.entity'

/** A position's name: the one saved on the camera, else the reserved one, else its number. */
export function presetLabel(presets: PtzPreset[], presetId: number): string {
  return (
    presets.find((p) => p.presetId === presetId)?.label ??
    PRESET_LABELS[presetId] ??
    `Position ${presetId}`
  )
}
