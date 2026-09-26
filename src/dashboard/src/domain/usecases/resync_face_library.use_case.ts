import type { ProfileRepository } from '../ports/profile.port'

export class ResyncFaceLibrary {
  constructor(private readonly repository: ProfileRepository) {}
  execute(): Promise<number> {
    return this.repository.resyncFaceLibrary()
  }
}
