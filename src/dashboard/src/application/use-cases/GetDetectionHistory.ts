import type {
  DetectionHistoryPage,
  DetectionHistoryQuery,
} from '../../domain/entities/DetectionHistory'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class GetDetectionHistory {
  constructor(private readonly repository: ProfileRepository) {}
  execute(query: DetectionHistoryQuery): Promise<DetectionHistoryPage> {
    return this.repository.getDetectionHistory(query)
  }
}
