import type { ProfileCameraLink } from '../entities/profile_camera_link.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class SetProfileCameraLinks {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string, cameraIds: string[]): Promise<ProfileCameraLink[]> {
    return this.repository.setCameraLinks(profileId, cameraIds)
  }
}
