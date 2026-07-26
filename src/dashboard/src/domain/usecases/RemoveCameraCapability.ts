import type { Capability } from '../entities/CameraCapabilityBinding'
import type { CameraRepository } from '../ports/CameraRepository'

export class RemoveCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, capability: Capability): Promise<void> {
    return this.repository.removeCapability(cameraId, capability)
  }
}
