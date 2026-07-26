import type { CameraDraftInput } from '../entities/CameraDraftInput'
import type { CameraStatus } from '../entities/CameraStatus'
import type { CameraRepository } from '../ports/CameraRepository'

export class VerifyDraftCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: CameraDraftInput): Promise<CameraStatus> {
    return this.repository.verifyDraft(input)
  }
}
