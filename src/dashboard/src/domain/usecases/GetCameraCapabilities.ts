import type { CameraCapabilityBinding } from '../entities/CameraCapabilityBinding'
import type { CameraRepository } from '../ports/CameraRepository'

export class GetCameraCapabilities {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraCapabilityBinding[]> {
    return this.repository.getCapabilities(cameraId)
  }
}
