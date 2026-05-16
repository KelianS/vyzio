import type { Profile } from '../../domain/entities/Profile'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class GetProfiles {
  constructor(private readonly repository: ProfileRepository) {}
  execute(): Promise<Profile[]> {
    return this.repository.getAll()
  }
}
