import type { CurrentSession } from '../entities/Access'
import type { AccessRepository } from '../ports/AccessRepository'

export class GetCurrentSession {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<CurrentSession | null> {
    return this.repository.getCurrentSession()
  }
}
