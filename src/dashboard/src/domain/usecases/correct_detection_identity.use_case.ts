import type { ProfileRepository } from '../ports/profile.port'

export class CorrectDetectionIdentity {
  constructor(private readonly repository: ProfileRepository) {}
  execute(eventId: string, profileId: string | null): Promise<void> {
    return this.repository.correctDetectionIdentity(eventId, profileId)
  }
}
