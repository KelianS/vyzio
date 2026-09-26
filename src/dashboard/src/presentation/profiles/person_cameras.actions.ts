import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'

export type PersonCamerasAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; links: ProfileCameraLink[] }
  | { type: 'LOAD_FAILED' }
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
