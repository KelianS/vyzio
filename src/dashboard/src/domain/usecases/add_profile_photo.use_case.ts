import type { ProfilePhoto } from '../entities/profile_photo.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class AddProfilePhoto {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string, file: File): Promise<ProfilePhoto> {
    return this.repository.addPhoto(profileId, file)
  }
}
