import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type { DetectionLabelsRepository } from '../../domain/usecases/get_detection_labels.use_case'
import { fetchJson } from '../http/fetch_json'

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
