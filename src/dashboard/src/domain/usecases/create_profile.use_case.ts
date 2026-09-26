import type { Profile } from '../entities/profile.entity'
import type { ProfileRepository, CreateProfileRequest } from '../ports/profile.port'

export class CreateProfile {
  constructor(private readonly repository: ProfileRepository) {}
  execute(request: CreateProfileRequest): Promise<Profile> {
    return this.repository.create(request)
  }
}
