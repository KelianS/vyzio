import type { AppError } from '../../common/errors/app_error'
import type { RecordingSettings } from '../../domain/entities/recording_settings.entity'

export interface ConservationUido {
  settings: RecordingSettings | null
  loading: boolean
  error: AppError | null
  saving: boolean
}

export function buildInitialConservationUido(): ConservationUido {
  return { settings: null, loading: true, error: null, saving: false }
}
