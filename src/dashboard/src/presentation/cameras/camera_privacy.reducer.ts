import {
  PARKING_PRESET_ID,
  SURVEILLANCE_PRESET_ID,
  type PtzPreset,
} from '../../domain/entities/ptz_preset.entity'
import type { CameraPrivacyAction } from './camera_privacy.actions'
import type { CameraPrivacyUido } from './camera_privacy.uido'

// Parking needs both positions: it pivots to one and comes back to the other (ADR-57).
function positionsSaved(presets: PtzPreset[]): boolean {
  const saved = (slot: number) =>
    presets.some((preset) => preset.presetId === slot && preset.configured)
  return saved(PARKING_PRESET_ID) && saved(SURVEILLANCE_PRESET_ID)
}

export function cameraPrivacyReducer(
  state: CameraPrivacyUido,
  action: CameraPrivacyAction,
): CameraPrivacyUido {
  switch (action.type) {
    // Another camera's failure must not stay on screen while this one is read.
    case 'PRESETS_STARTED':
      return { ...state, presetsError: null }
    case 'PRESETS_LOADED':
      return { ...state, positionsSaved: positionsSaved(action.presets), presetsError: null }
    // Unknown after a failed read: it must not pass for positions never saved.
    case 'PRESETS_FAILED':
      return { ...state, positionsSaved: null, presetsError: action.error }
    case 'PRESETS_SKIPPED':
      return { ...state, positionsSaved: null, presetsError: null }

    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }

    // The rules are the house's, not the camera's: a re-read keeps the count shown.
    case 'RULES_STARTED':
      return { ...state, rulesError: null }
    case 'RULES_LOADED':
      return { ...state, rules: action.rules, rulesError: null }
    // Unread rules must not pass for "no range" (DESIGN SYSTEM § Errors).
    case 'RULES_FAILED':
      return { ...state, rules: null, rulesError: action.error }
  }
}
