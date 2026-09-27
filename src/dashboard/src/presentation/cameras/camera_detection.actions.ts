import type { AppError } from '../../common/errors/app_error'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'

export type CameraDetectionAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; config: DetectionConfig; labels: DetectionLabel[] }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'CAMERA_GONE' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_SUCCEEDED'; config: DetectionConfig }
  | { type: 'SAVE_FINISHED' }
