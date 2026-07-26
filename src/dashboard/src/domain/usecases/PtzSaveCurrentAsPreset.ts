import type { CameraRepository } from '../ports/CameraRepository'

export class PtzSaveCurrentAsPreset {
  constructor(private readonly repository: CameraRepository) {}

  async execute(cameraId: string, presetId: number): Promise<void> {
    return this.repository.ptzSaveCurrentAsPreset(cameraId, presetId)
  }
}
