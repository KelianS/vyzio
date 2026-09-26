import type { CameraDraftInput } from '../entities/camera_draft_input.entity'
import type { CameraStatus } from '../entities/camera_status.entity'
import type { CameraRepository } from '../ports/camera.port'

export class VerifyDraftCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: CameraDraftInput): Promise<CameraStatus> {
    return this.repository.verifyDraft(input)
  }
}
