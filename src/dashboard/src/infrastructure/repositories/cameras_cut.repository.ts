import type { CamerasCut } from '../../domain/entities/cameras_cut.entity'
import type { ChosenEnd } from '../../domain/entities/chosen_end.entity'
import type { CamerasCutRepository } from '../../domain/ports/cameras_cut.port'
import { fetchJson, putJson } from '../http/fetch_json'

export class HttpCamerasCutRepository implements CamerasCutRepository {
  constructor(private readonly apiBaseUrl: string) {}

  getCamerasCut(): Promise<CamerasCut> {
    return fetchJson<CamerasCut>(this.url())
  }

  async cutCameras(end: ChosenEnd): Promise<void> {
    await putJson<unknown>(this.url(), end)
  }

  private url() {
    return `${this.apiBaseUrl}/api/cameras/privacy/cut`
  }
}
