import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { DetectionLabelsRepository } from '../../application/use-cases/GetDetectionLabels'
import { fetchJson } from '../http/fetchJson'

export class HttpCameraLabelsRepository implements DetectionLabelsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getAll(): Promise<DetectionLabel[]> {
    return fetchJson<DetectionLabel[]>(`${this.apiBaseUrl}/api/detection-labels/camera`)
  }
}

export class HttpNotificationLabelsRepository implements DetectionLabelsRepository {
  constructor(private readonly apiBaseUrl: string) {}

  async getAll(): Promise<DetectionLabel[]> {
    return fetchJson<DetectionLabel[]>(`${this.apiBaseUrl}/api/detection-labels/notifications`)
  }
}
