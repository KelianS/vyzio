import type { CurrentSession } from '../entities/access.entity'
import type { AccessRepository } from '../ports/access.port'

export class GetCurrentSession {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<CurrentSession | null> {
    return this.repository.getCurrentSession()
  }
}
