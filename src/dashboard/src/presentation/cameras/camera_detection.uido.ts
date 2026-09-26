import type { AppError } from '../../common/errors/app_error'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'

export interface CameraDetectionUido {
  config: DetectionConfig | null
  /** The whole catalogue; the camera narrows it to what it reports detecting. */
  labels: DetectionLabel[]
  loading: boolean
  error: AppError | null
  saving: boolean
}

export function buildInitialCameraDetectionUido(): CameraDetectionUido {
  return { config: null, labels: [], loading: true, error: null, saving: false }
}
