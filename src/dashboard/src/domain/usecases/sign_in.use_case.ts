import type { CurrentSession } from '../entities/access.entity'
import type { AccessRepository } from '../ports/access.port'

export class SignIn {
  constructor(private readonly repository: AccessRepository) {}

  async execute(password: string): Promise<CurrentSession | null> {
    return this.repository.signIn(password)
  }
}
