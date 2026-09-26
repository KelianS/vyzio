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

    case 'SCHEDULES_RELOADING':
      return { ...state, schedulesLoading: true }
    case 'SCHEDULES_LOADED':
      return { ...state, schedulesLoading: false, schedules: action.schedules }
    case 'SCHEDULES_READ_FAILED':
      return { ...state, schedulesLoading: false }

    case 'DAY_TOGGLED': {
      const { days } = state.form
      const toggled = days.includes(action.day)
        ? days.filter((day) => day !== action.day)
        : [...days, action.day].sort((a, b) => a - b)
      return { ...state, form: { ...state.form, days: toggled } }
    }
    case 'START_TIME_SET':
      return { ...state, form: { ...state.form, startTime: action.value } }
    case 'END_TIME_SET':
      return { ...state, form: { ...state.form, endTime: action.value } }

    case 'SCHEDULE_INVALID':
      return { ...state, invalid: action.message }
    case 'SCHEDULE_ADD_STARTED':
      return { ...state, adding: true, invalid: null, scheduleFailure: null }
    case 'SCHEDULE_ADD_FINISHED':
      return { ...state, adding: false }
    case 'SCHEDULE_FAILED':
      return { ...state, scheduleFailure: action.error }
    case 'SCHEDULE_DELETED':
      return {
        ...state,
        schedules: state.schedules.filter((schedule) => schedule.id !== action.scheduleId),
      }
  }
}
