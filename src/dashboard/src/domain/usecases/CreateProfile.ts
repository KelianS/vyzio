import type { Profile } from '../entities/Profile'
import type { ProfileRepository, CreateProfileRequest } from '../ports/ProfileRepository'

export class CreateProfile {
  constructor(private readonly repository: ProfileRepository) {}
  execute(request: CreateProfileRequest): Promise<Profile> {
    return this.repository.create(request)
  }
}
