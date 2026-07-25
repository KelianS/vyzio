import type { CameraCapabilityBinding, Capability } from '../entities/CameraCapabilityBinding'
import type { CameraRepository } from '../ports/CameraRepository'

export class ProbeCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, capability: Capability): Promise<CameraCapabilityBinding> {
    return this.repository.probeCapability(cameraId, capability)
  }
}
