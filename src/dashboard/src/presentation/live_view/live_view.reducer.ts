import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import type { LiveViewAction } from './live_view.actions'
import type { LiveViewUido, PresetActivity } from './live_view.uido'

/** Where the camera stands, when that matches one of the saved positions. */
function matchPreset(
  presets: PtzPreset[],
  position: { x: number; y: number } | null,
): number | null {
  if (!position) return null
  return presets.find((p) => p.panMs === position.x && p.tiltMs === position.y)?.presetId ?? null
}

function withActivity(state: LiveViewUido, presetId: number, activity: PresetActivity) {
  return { ...state, activities: { ...state.activities, [presetId]: activity } }
}

export function liveViewReducer(state: LiveViewUido, action: LiveViewAction): LiveViewUido {
  switch (action.type) {
    case 'QUALITY_CHOSEN':
      return { ...state, quality: action.quality }
    case 'SOUND_TOGGLED':
      return { ...state, soundOn: !state.soundOn }

    // A retry hides the failure while the camera is asked again, without showing a slot as empty.
    case 'PRESETS_STARTED':
      return { ...state, presets: null, presetsError: null }
    case 'PRESETS_LOADED':
      return {
        ...state,
        presets: action.presets,
        calibrated: action.calibrated,
        activePresetId: matchPreset(action.presets, action.currentPosition),
        presetsError: null,
      }
    // Unread is not empty: the slots give way to the failure (ADR-09).
    case 'PRESETS_FAILED':
      return { ...state, presets: null, presetsError: action.error }

    // Moving means leaving the saved position.
    case 'MOVE_STARTED':
      return { ...state, activePresetId: null }

    case 'GOTO_STARTED':
      return withActivity(state, action.presetId, 'going')
    case 'SAVE_STARTED':
      return withActivity(state, action.presetId, 'saving')
    case 'GOTO_SUCCEEDED':
    case 'SAVE_SUCCEEDED':
      return { ...state, activePresetId: action.presetId }
    case 'PRESET_ACTION_FINISHED':
      return withActivity(state, action.presetId, 'idle')

    case 'CALIBRATION_LOST':
      return { ...state, calibrated: false }
    case 'CALIBRATE_STARTED':
      return { ...state, calibrating: true }
    case 'CALIBRATE_FINISHED':
      return { ...state, calibrating: false }

    case 'THUMBNAIL_CAPTURED':
      return {
        ...state,
        presets:
          state.presets?.map((p) =>
            p.presetId === action.presetId ? { ...p, thumbnail: true } : p,
          ) ?? null,
        thumbnailVersions: { ...state.thumbnailVersions, [action.presetId]: action.version },
      }

    case 'OVERRIDE_ASKED':
      return { ...state, overridePresetId: action.presetId }
    case 'OVERRIDE_CLOSED':
      return { ...state, overridePresetId: null }

    // A retry hides the failure while the list is read again, without showing it empty.
    case 'CLIPS_STARTED':
      return { ...state, clipsError: null }
    case 'CLIPS_LOADED':
      return {
        ...state,
        clips: action.clips,
        clipLabels: action.labels,
        clipsRecent: action.recent,
        clipsError: null,
      }
    // Unread is not empty: the list gives way to the failure.
    case 'CLIPS_FAILED':
      return { ...state, clips: null, clipsError: action.error }
    case 'CLIP_PLAYED':
      return { ...state, playingId: action.eventId }
    case 'LIVE_RESUMED':
      return { ...state, playingId: null }
    case 'CLIP_GONE':
      return { ...state, clipGoneId: action.eventId }

    case 'PRIVACY_STARTED':
      return { ...state, privacyBusy: true }
    case 'PRIVACY_FINISHED':
      return { ...state, privacyBusy: false }
  }
}
