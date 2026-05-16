import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { DetectionLabelsRepository } from '../../application/use-cases/GetDetectionLabels'

export class HttpDetectionLabelsRepository implements DetectionLabelsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getAll(): Promise<DetectionLabel[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/detection-labels`)
    if (!response.ok) throw new Error(`Failed to fetch detection labels: ${response.status}`)
    return response.json() as Promise<DetectionLabel[]>
  }
}
