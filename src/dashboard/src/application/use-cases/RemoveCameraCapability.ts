import type { Capability } from '../../domain/entities/CameraCapabilityBinding'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class RemoveCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, capability: Capability): Promise<void> {
    return this.repository.removeCapability(cameraId, capability)
  }
}
