import type { DetectionLabel } from '../entities/DetectionLabel'

export interface DetectionLabelsRepository {
  getAll(): Promise<DetectionLabel[]>
}

export class GetDetectionLabels {
  constructor(private readonly repository: DetectionLabelsRepository) {}
  execute(): Promise<DetectionLabel[]> {
    return this.repository.getAll()
  }
}
