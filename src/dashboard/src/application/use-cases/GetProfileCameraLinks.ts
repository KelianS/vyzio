import type { ProfileCameraLink } from '../../domain/entities/ProfileCameraLink'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class GetProfileCameraLinks {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string): Promise<ProfileCameraLink[]> {
    return this.repository.getCameraLinks(profileId)
  }
}
