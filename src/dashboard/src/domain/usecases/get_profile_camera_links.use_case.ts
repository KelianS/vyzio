import type { ProfileCameraLink } from '../entities/profile_camera_link.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class GetProfileCameraLinks {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string): Promise<ProfileCameraLink[]> {
    return this.repository.getCameraLinks(profileId)
  }
}
