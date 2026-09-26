import type { CameraCapabilityBinding } from '../entities/CameraCapabilityBinding'
import type { CameraRepository } from '../ports/CameraRepository'

export class SetPtzPanInverted {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, inverted: boolean): Promise<CameraCapabilityBinding> {
    return this.repository.setPtzPanInverted(cameraId, inverted)
  }
}
