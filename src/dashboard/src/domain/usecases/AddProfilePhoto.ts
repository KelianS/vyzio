import type { ProfilePhoto } from '../entities/ProfilePhoto'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class AddProfilePhoto {
  constructor(private readonly repository: ProfileRepository) {}
  execute(profileId: string, file: File): Promise<ProfilePhoto> {
    return this.repository.addPhoto(profileId, file)
  }
}
