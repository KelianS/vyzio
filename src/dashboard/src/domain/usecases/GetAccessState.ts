import type { AccessState } from '../entities/Access'
import type { AccessRepository } from '../ports/AccessRepository'

export class GetAccessState {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<AccessState> {
    return this.repository.getState()
  }
}
