import type { AppError } from '../../common/errors/app_error'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'

export type LiveViewAction =
  | { type: 'PRESETS_STARTED' }
  | {
      type: 'PRESETS_LOADED'
      presets: PtzPreset[]
      calibrated: boolean
      currentPosition: { x: number; y: number } | null
    }
  | { type: 'PRESETS_FAILED'; error: AppError }
  | { type: 'MOVE_STARTED' }
  | { type: 'GOTO_STARTED'; presetId: number }
  | { type: 'GOTO_SUCCEEDED'; presetId: number }
  | { type: 'SAVE_STARTED'; presetId: number }
  | { type: 'SAVE_SUCCEEDED'; presetId: number }
  | { type: 'PRESET_ACTION_FINISHED'; presetId: number }
  | { type: 'CALIBRATION_LOST' }
  | { type: 'CALIBRATE_STARTED' }
  | { type: 'CALIBRATE_FINISHED' }
  | { type: 'THUMBNAIL_CAPTURED'; presetId: number; version: number }
  | { type: 'OVERRIDE_ASKED'; presetId: number }
  | { type: 'OVERRIDE_CLOSED' }
