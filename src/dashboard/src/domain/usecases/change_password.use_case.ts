import type { PasswordChangeResult } from '../entities/access.entity'
import type { AccessRepository } from '../ports/access.port'

/**
 * Changing a password one still knows. The old one is asked for again: a device left unlocked is
 * not consent (ADR-54).
 */
export class ChangePassword {
  constructor(private readonly repository: AccessRepository) {}

  async execute(currentPassword: string, newPassword: string): Promise<PasswordChangeResult> {
    return this.repository.changePassword(currentPassword, newPassword)
  }
}
