import type { CameraCapabilityBinding, Capability } from '../../domain/entities/CameraCapabilityBinding'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class ProbeCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, capability: Capability): Promise<CameraCapabilityBinding> {
    return this.repository.probeCapability(cameraId, capability)
  }
}
