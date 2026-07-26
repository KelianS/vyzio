import type { DetectionHistoryPage, DetectionHistoryQuery } from '../entities/DetectionHistory'
import type { ProfileRepository } from '../ports/ProfileRepository'

export class GetDetectionHistory {
  constructor(private readonly repository: ProfileRepository) {}
  execute(query: DetectionHistoryQuery): Promise<DetectionHistoryPage> {
    return this.repository.getDetectionHistory(query)
  }
}
