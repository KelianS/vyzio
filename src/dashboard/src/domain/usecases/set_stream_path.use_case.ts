import type { CameraCapabilityBinding } from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class SetStreamPath {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, path: string | null): Promise<CameraCapabilityBinding> {
    return this.repository.setStreamPath(cameraId, path)
  }
}
