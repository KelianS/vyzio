import type { ProfileRepository } from '../ports/profile.port'

export class CheckDetectionClip {
  constructor(private readonly repository: ProfileRepository) {}
  execute(eventId: string): Promise<boolean> {
    return this.repository.hasDetectionClip(eventId)
  }
}
