import type {
  CameraCapabilityBinding,
  Capability,
} from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class ProbeCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, capability: Capability): Promise<CameraCapabilityBinding> {
    return this.repository.probeCapability(cameraId, capability)
  }
}
