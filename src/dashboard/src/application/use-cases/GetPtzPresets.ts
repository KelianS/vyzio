import type { CameraRepository } from '../../domain/ports/CameraRepository'
import type { PtzPreset } from '../../domain/entities/PtzPreset'

export class GetPtzPresets {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string): Promise<PtzPreset[]> {
    return this.repository.getPtzPresets(cameraId)
  }
}
