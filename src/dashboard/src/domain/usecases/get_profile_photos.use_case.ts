import type { ProfilePhoto } from '../entities/profile_photo.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class GetProfilePhotos {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string): Promise<ProfilePhoto[]> {
    return this.repository.getPhotos(profileId)
  }
}
