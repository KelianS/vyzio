import type { ProfileCameraLink } from '../entities/ProfileCameraLink'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class GetProfileCameraLinks {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string): Promise<ProfileCameraLink[]> {
    return this.repository.getCameraLinks(profileId)
  }
}
