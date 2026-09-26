import type { AccessState } from '../entities/access.entity'
import type { AccessRepository } from '../ports/access.port'

export class GetAccessState {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<AccessState> {
    return this.repository.getState()
  }
}
