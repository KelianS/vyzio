import type { StreamProtocol } from '../entities/camera_capability_binding.entity'
import type { AvailableStream } from '../entities/camera_stream.entity'
import type { CameraStreamRepository } from '../ports/camera_stream.port'

export class GetAvailableCameraStreams {
  constructor(private readonly repository: CameraStreamRepository) {}

  async execute(cameraId: string, protocol: StreamProtocol): Promise<AvailableStream[]> {
    return this.repository.getAvailableStreams(cameraId, protocol)
  }
}
