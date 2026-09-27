import type { AppError } from '../../common/errors/app_error'
import type { DetectionConfig } from '../../domain/entities/detection_config.entity'

export interface CameraConservationUido {
  /** Null once loaded means the camera no longer exists. */
  config: DetectionConfig | null
  loading: boolean
  error: AppError | null
  saving: boolean
}

export function buildInitialCameraConservationUido(): CameraConservationUido {
  return { config: null, loading: true, error: null, saving: false }
}
