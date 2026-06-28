import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class PtzGoToPreset {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, presetId: number): Promise<void> {
    return this.repository.ptzGoToPreset(cameraId, presetId)
  }
}
