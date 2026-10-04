import type { Capability } from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class TryCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, capability: Capability): Promise<void> {
    return this.repository.tryCapability(cameraId, capability)
  }
}
