import type { ProfileRepository } from '../ports/ProfileRepository'

export class CorrectDetectionIdentity {
  constructor(private readonly repository: ProfileRepository) {}
  execute(eventId: string, profileId: string | null): Promise<void> {
    return this.repository.correctDetectionIdentity(eventId, profileId)
  }
}
