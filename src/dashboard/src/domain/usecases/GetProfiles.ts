import type { Profile } from '../entities/Profile'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class GetProfiles {
  constructor(private readonly repository: ProfileRepository) {}
  execute(): Promise<Profile[]> {
    return this.repository.getAll()
  }
}
