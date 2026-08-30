import type { AccessRepository } from '../ports/AccessRepository'

export class SignOut {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<void> {
    return this.repository.signOut()
  }
}
