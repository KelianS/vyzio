import type { CurrentSession } from '../entities/Access'
import type { AccessRepository } from '../ports/AccessRepository'

export class SignIn {
  constructor(private readonly repository: AccessRepository) {}

  async execute(password: string): Promise<CurrentSession | null> {
    return this.repository.signIn(password)
  }
}
