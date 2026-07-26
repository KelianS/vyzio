import type { CameraRepository } from '../ports/CameraRepository'

export class PtzSavePreset {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, presetId: number): Promise<void> {
    return this.repository.ptzSavePreset(cameraId, presetId)
  }
}
