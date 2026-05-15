import type { ProfilePhoto } from '../../domain/entities/ProfilePhoto'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class GetProfilePhotos {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string): Promise<ProfilePhoto[]> {
    return this.repository.getPhotos(profileId)
  }
}
