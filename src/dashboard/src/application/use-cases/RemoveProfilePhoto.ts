import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class RemoveProfilePhoto {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string, photoId: string): Promise<void> {
    return this.repository.removePhoto(profileId, photoId)
  }
}
