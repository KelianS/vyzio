import type { AppError } from '../../common/errors/app_error'
import type { CameraCapabilityBinding } from '../../domain/entities/camera_capability_binding.entity'
import type { CameraImageSettings } from '../../domain/entities/camera_image_settings.entity'

export type CameraImageAction =
  | { type: 'SETTINGS_STARTED' }
  | { type: 'SETTINGS_LOADED'; settings: CameraImageSettings }
  | { type: 'SETTINGS_FAILED' }
  | { type: 'BINDINGS_LOADED'; bindings: CameraCapabilityBinding[] }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
  | {
      type: 'PTZ_LOADED'
      calibrated: boolean
      currentPosition: { x: number; y: number } | null
    }
  | { type: 'PTZ_FAILED'; error: AppError }
  | { type: 'LIVE_VIEW_OPENED' }
  | { type: 'LIVE_VIEW_CLOSED' }
