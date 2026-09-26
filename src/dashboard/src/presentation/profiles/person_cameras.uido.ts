import type { ProfileCameraLink } from '../../domain/entities/profile_camera_link.entity'

export interface PersonCamerasUido {
  links: ProfileCameraLink[] | null
  loading: boolean
  saving: boolean
}

export function buildInitialPersonCamerasUido(): PersonCamerasUido {
  return { links: null, loading: true, saving: false }
}
