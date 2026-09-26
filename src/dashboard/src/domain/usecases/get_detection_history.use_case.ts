import type {
  DetectionHistoryPage,
  DetectionHistoryQuery,
} from '../entities/detection_history.entity'
import type { ProfileRepository } from '../ports/profile.port'

export class GetDetectionHistory {
  constructor(private readonly repository: ProfileRepository) {}
  execute(query: DetectionHistoryQuery): Promise<DetectionHistoryPage> {
    return this.repository.getDetectionHistory(query)
  }
}
