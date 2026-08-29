import type { CurrentSession } from '../entities/Access'
import type { AccessRepository } from '../ports/AccessRepository'

export class CreateOwnerAccount {
  constructor(private readonly repository: AccessRepository) {}

  async execute(password: string): Promise<CurrentSession> {
    return this.repository.createOwner(password)
  }
}
