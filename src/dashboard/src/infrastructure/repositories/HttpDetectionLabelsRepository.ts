import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { DetectionLabelsRepository } from '../../application/use-cases/GetDetectionLabels'

export class HttpCameraLabelsRepository implements DetectionLabelsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getAll(): Promise<DetectionLabel[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/detection-labels/camera`)
    if (!response.ok) throw new Error(`Failed to fetch camera labels: ${response.status}`)
    return response.json() as Promise<DetectionLabel[]>
  }
}

export class HttpNotificationLabelsRepository implements DetectionLabelsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getAll(): Promise<DetectionLabel[]> {
    const response = await fetch(`${this.apiBaseUrl}/api/detection-labels/notifications`)
    if (!response.ok) throw new Error(`Failed to fetch notification labels: ${response.status}`)
    return response.json() as Promise<DetectionLabel[]>
  }
}
