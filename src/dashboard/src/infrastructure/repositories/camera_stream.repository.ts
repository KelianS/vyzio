import type { StreamProtocol } from '../../domain/entities/camera_capability_binding.entity'
import type {
  AvailableStream,
  CameraStreamAddition,
  CameraStreamLineup,
  StreamRole,
} from '../../domain/entities/camera_stream.entity'
import type { CameraStreamRepository } from '../../domain/ports/camera_stream.port'
import { deleteJson, fetchJson, postJson, putJson } from '../http/fetch_json'

export class HttpCameraStreamRepository implements CameraStreamRepository {
  constructor(private readonly apiBaseUrl: string) {}

  private url(cameraId: string, rest = '') {
    return `${this.apiBaseUrl}/api/cameras/${cameraId}/streams${rest}`
  }

  async getStreams(cameraId: string): Promise<CameraStreamLineup> {
    return fetchJson<CameraStreamLineup>(this.url(cameraId))
  }

  async getAvailableStreams(
    cameraId: string,
    protocol: StreamProtocol,
  ): Promise<AvailableStream[]> {
    return fetchJson<AvailableStream[]>(this.url(cameraId, `/available?protocol=${protocol}`))
  }

  async addStream(cameraId: string, addition: CameraStreamAddition): Promise<CameraStreamLineup> {
    return postJson<CameraStreamLineup>(this.url(cameraId), addition)
  }

  async setStreamRole(
    cameraId: string,
    streamId: string,
    role: StreamRole,
  ): Promise<CameraStreamLineup> {
    return putJson<CameraStreamLineup>(this.url(cameraId, `/${streamId}/role`), { role })
  }

  async removeStream(cameraId: string, streamId: string): Promise<CameraStreamLineup> {
    return deleteJson<CameraStreamLineup>(this.url(cameraId, `/${streamId}`))
  }

  async checkStream(cameraId: string, streamId: string): Promise<CameraStreamLineup> {
    return postJson<CameraStreamLineup>(this.url(cameraId, `/${streamId}/check`))
  }
}
