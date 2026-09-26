import type { CurrentSession } from '../entities/access.entity'
import type { AccessRepository } from '../ports/access.port'

export class CreateOwnerAccount {
  constructor(private readonly repository: AccessRepository) {}

  async execute(password: string): Promise<CurrentSession> {
    return this.repository.createOwner(password)
  }
}
