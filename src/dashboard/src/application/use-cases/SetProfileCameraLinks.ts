import type { ProfileCameraLink } from '../../domain/entities/ProfileCameraLink'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class SetProfileCameraLinks {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string, cameraIds: string[]): Promise<ProfileCameraLink[]> {
    return this.repository.setCameraLinks(profileId, cameraIds)
  }
}
