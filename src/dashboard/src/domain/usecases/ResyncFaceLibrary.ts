import type { ProfileRepository } from '../ports/ProfileRepository'

export class ResyncFaceLibrary {
  constructor(private readonly repository: ProfileRepository) {}
  execute(): Promise<number> {
    return this.repository.resyncFaceLibrary()
  }
}
