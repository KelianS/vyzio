import type { CameraStreamAddition, CameraStreamLineup } from '../entities/camera_stream.entity'
import type { CameraStreamRepository } from '../ports/camera_stream.port'

export class AddCameraStream {
  constructor(private readonly repository: CameraStreamRepository) {}

  async execute(cameraId: string, addition: CameraStreamAddition): Promise<CameraStreamLineup> {
    return this.repository.addStream(cameraId, addition)
  }
}
