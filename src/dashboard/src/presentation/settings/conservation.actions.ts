import type { AppError } from '../../common/errors/app_error'
import type { RecordingSettings } from '../../domain/entities/recording_settings.entity'

export type ConservationAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; settings: RecordingSettings }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
