import type { Profile } from '../../domain/entities/Profile'
import type { ProfileRepository, UpdateProfileRequest } from '../../domain/ports/ProfileRepository'

export class UpdateProfile {
  constructor(private readonly repository: ProfileRepository) {}
  execute(id: string, request: UpdateProfileRequest): Promise<Profile> {
    return this.repository.update(id, request)
  }
}
