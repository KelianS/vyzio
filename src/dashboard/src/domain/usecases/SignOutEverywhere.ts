import type { AccessRepository } from '../ports/AccessRepository'

/** The gesture for a lost phone: every device stops opening, this one included (ADR-54). */
export class SignOutEverywhere {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<void> {
    return this.repository.signOutEverywhere()
  }
}
