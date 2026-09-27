import type { AppError } from '../../common/errors/app_error'
import type { CameraPrivacySchedule } from '../../domain/entities/camera_privacy_schedule.entity'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'

export type CameraPrivacyAction =
  | { type: 'PRESETS_STARTED' }
  | { type: 'PRESETS_LOADED'; presets: PtzPreset[] }
  | { type: 'PRESETS_FAILED'; error: AppError }
  | { type: 'PRESETS_SKIPPED' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
  | { type: 'SCHEDULES_RELOADING' }
  | { type: 'SCHEDULES_LOADED'; schedules: CameraPrivacySchedule[] }
  | { type: 'SCHEDULES_READ_FAILED'; error: AppError }
  | { type: 'SCHEDULE_FORM_OPENED' }
  | { type: 'SCHEDULE_FORM_CLOSED' }
  | { type: 'DAY_TOGGLED'; day: number }
  | { type: 'START_TIME_SET'; value: string }
  | { type: 'END_TIME_SET'; value: string }
  | { type: 'SCHEDULE_INVALID'; message: string }
  | { type: 'SCHEDULE_ADD_STARTED' }
  | { type: 'SCHEDULE_ADD_FINISHED' }
  | { type: 'SCHEDULE_FAILED'; error: AppError }
  | { type: 'SCHEDULE_ADDED'; schedule: CameraPrivacySchedule }
  | { type: 'SCHEDULE_DELETED'; scheduleId: string }
