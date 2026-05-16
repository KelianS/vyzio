import type { DetectionLabel } from '../../domain/entities/DetectionLabel'

export interface DetectionLabelsRepository {
  getAll(): Promise<DetectionLabel[]>
}

export class GetDetectionLabels {
  constructor(private readonly repository: DetectionLabelsRepository) {}
  execute(): Promise<DetectionLabel[]> {
    return this.repository.getAll()
  }
}
