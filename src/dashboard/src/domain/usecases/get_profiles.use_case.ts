import type { Profile } from '../entities/profile.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class GetProfiles {
  constructor(private readonly repository: ProfileRepository) {}
  execute(): Promise<Profile[]> {
    return this.repository.getAll()
  }
}
