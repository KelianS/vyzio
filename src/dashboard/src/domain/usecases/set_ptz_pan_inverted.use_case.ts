import type { CameraCapabilityBinding } from '../entities/camera_capability_binding.entity'
import type { CameraRepository } from '../ports/camera.port'

export class SetPtzPanInverted {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, inverted: boolean): Promise<CameraCapabilityBinding> {
    return this.repository.setPtzPanInverted(cameraId, inverted)
  }
}
