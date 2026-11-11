import type { ProfileRepository } from '../ports/profile.port'

export class DeleteDetection {
  constructor(private readonly repository: ProfileRepository) {}
  execute(eventId: string): Promise<void> {
    return this.repository.deleteDetection(eventId)
  }
}
