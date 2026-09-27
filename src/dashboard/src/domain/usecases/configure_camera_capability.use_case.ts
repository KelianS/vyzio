import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class ConfigureCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
    capability: Capability,
    protocol: SupportedProtocol,
  ): Promise<CameraCapabilityBinding> {
    return this.repository.configureCapability(cameraId, capability, protocol)
  }
}
