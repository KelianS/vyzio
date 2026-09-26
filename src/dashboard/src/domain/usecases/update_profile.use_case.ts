import type { Profile } from '../entities/profile.entity'
import type { ProfileRepository, UpdateProfileRequest } from '../ports/profile.port'

export class UpdateProfile {
  constructor(private readonly repository: ProfileRepository) {}
  execute(id: string, request: UpdateProfileRequest): Promise<Profile> {
    return this.repository.update(id, request)
  }
}
