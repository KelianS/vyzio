import type { Capability } from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class RemoveCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, capability: Capability): Promise<void> {
    return this.repository.removeCapability(cameraId, capability)
  }
}
