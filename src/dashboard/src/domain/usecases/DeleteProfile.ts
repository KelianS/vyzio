import type { ProfileRepository } from '../ports/ProfileRepository'

export class DeleteProfile {
  constructor(private readonly repository: ProfileRepository) {}
  execute(id: string): Promise<void> {
    return this.repository.delete(id)
  }
}
