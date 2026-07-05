import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../domain/entities/CameraCapabilityBinding'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

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
