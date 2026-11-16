import type { Camera } from '../entities/camera.entity'
import type { CameraRepository } from '../ports/camera.port'

/** Asks the camera again for the privacy state it already holds, after a miss (PRIV-05). */
export class RetryCameraPrivacy {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<Camera> {
    return this.repository.retryPrivacy(cameraId)
  }
}
