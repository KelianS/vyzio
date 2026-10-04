import type {
  CameraCapabilityBinding,
  Capability,
} from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class ConfirmCameraCapability {
  constructor(private readonly repository: CameraRepository) {}

  async execute(
    cameraId: string,
    capability: Capability,
    worked: boolean,
  ): Promise<CameraCapabilityBinding> {
    return this.repository.confirmCapability(cameraId, capability, worked)
  }
}
