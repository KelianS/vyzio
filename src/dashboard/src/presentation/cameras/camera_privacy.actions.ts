import type { AppError } from '../../common/errors/app_error'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import type { ScheduleRule } from '../../domain/entities/schedule_rule.entity'

export type CameraPrivacyAction =
  | { type: 'PRESETS_STARTED' }
  | { type: 'PRESETS_LOADED'; presets: PtzPreset[] }
  | { type: 'PRESETS_FAILED'; error: AppError }
  | { type: 'PRESETS_SKIPPED' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
  | { type: 'RULES_STARTED' }
  | { type: 'RULES_LOADED'; rules: ScheduleRule[] }
  | { type: 'RULES_FAILED'; error: AppError }
