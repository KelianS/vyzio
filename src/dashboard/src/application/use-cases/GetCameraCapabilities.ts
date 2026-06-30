import type { CameraCapabilityBinding } from '../../domain/entities/CameraCapabilityBinding'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class GetCameraCapabilities {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<CameraCapabilityBinding[]> {
    return this.repository.getCapabilities(cameraId)
  }
}
