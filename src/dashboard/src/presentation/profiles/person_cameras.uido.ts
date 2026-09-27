import type { AppError } from '../../common/errors/app_error'
import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'

export interface PersonCamerasUido {
  links: ProfileCameraLink[] | null
  loading: boolean
  error: AppError | null
  saving: boolean
}

export function buildInitialPersonCamerasUido(): PersonCamerasUido {
  return { links: null, loading: true, error: null, saving: false }
}
