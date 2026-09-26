import type { AccessRepository } from '../ports/access.port'

export class SignOut {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<void> {
    return this.repository.signOut()
  }
}
