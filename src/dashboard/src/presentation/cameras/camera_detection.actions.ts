import type { AppError } from '../../common/errors/app_error'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'

export type CameraDetectionAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; config: DetectionConfig | null; labels: DetectionLabel[] }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
