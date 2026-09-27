import type { AppError } from '../../common/errors/app_error'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'

export type CameraConservationAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; config: DetectionConfig }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'CAMERA_GONE' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_SUCCEEDED'; config: DetectionConfig }
  | { type: 'SAVE_FINISHED' }
