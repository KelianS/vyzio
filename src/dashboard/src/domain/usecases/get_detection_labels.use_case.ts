import type { DetectionLabel } from '../entities/detection_label.entity'

export interface DetectionLabelsRepository {
  getAll(): Promise<DetectionLabel[]>
}

export class GetDetectionLabels {
  constructor(private readonly repository: DetectionLabelsRepository) {}
  execute(): Promise<DetectionLabel[]> {
    return this.repository.getAll()
  }
}
