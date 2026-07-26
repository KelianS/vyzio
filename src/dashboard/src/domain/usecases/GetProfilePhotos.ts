import type { ProfilePhoto } from '../entities/ProfilePhoto'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class GetProfilePhotos {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string): Promise<ProfilePhoto[]> {
    return this.repository.getPhotos(profileId)
  }
}
