import type { ProfileRepository } from '../../domain/ports/ProfileRepository'

export class ResyncFaceLibrary {
  constructor(private readonly repository: ProfileRepository) {}
  execute(): Promise<number> {
    return this.repository.resyncFaceLibrary()
  }
}
