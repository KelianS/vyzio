import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { CameraStatus } from '../../domain/entities/CameraStatus'
import type { CameraRepository } from '../../domain/ports/CameraRepository'

export class VerifyDraftCamera {
  constructor(private readonly repository: CameraRepository) {}

  async execute(input: CameraDraftInput): Promise<CameraStatus> {
    return this.repository.verifyDraft(input)
  }
}