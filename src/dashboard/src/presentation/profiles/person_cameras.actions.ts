import type { AppError } from '../../common/errors/app_error'
import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'

export type PersonCamerasAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; links: ProfileCameraLink[] }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_SUCCEEDED'; links: ProfileCameraLink[] }
  | { type: 'SAVE_FINISHED' }
