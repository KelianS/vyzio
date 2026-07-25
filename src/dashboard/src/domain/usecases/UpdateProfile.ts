import type { Profile } from '../entities/Profile'
import type { ProfileRepository, UpdateProfileRequest } from '../ports/ProfileRepository'

export class UpdateProfile {
  constructor(private readonly repository: ProfileRepository) {}
  execute(id: string, request: UpdateProfileRequest): Promise<Profile> {
    return this.repository.update(id, request)
  }
}
