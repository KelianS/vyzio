import type { ProfileRepository } from '../ports/profile.port'

export class RemoveProfilePhoto {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string, photoId: string): Promise<void> {
    return this.repository.removePhoto(profileId, photoId)
  }
}
