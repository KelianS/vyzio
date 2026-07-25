import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../entities/CameraCapabilityBinding'
import type { CameraRepository } from '../ports/CameraRepository'

export class ConfigureCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
    capability: Capability,
    protocol: SupportedProtocol,
    configJson?: string,
  ): Promise<CameraCapabilityBinding> {
    return this.repository.configureCapability(cameraId, capability, protocol, configJson)
  }
}
