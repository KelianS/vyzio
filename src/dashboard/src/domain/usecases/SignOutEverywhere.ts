import type { AccessRepository } from '../ports/AccessRepository'

/** Le geste du telephone perdu : tous les appareils cessent d'ouvrir, celui-ci compris (ADR-54). */
export class SignOutEverywhere {
  constructor(private readonly repository: AccessRepository) {}

  async execute(): Promise<void> {
    return this.repository.signOutEverywhere()
  }
}
