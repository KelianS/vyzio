import type { CameraCapabilityBinding } from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class GetCameraCapabilities {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraCapabilityBinding[]> {
    return this.repository.getCapabilities(cameraId)
  }
}
