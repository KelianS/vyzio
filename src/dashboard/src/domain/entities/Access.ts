/** What an account is allowed to do (ADR-54). */
export type AccountRole = 'owner' | 'resident'

/** Where the installation stands before anyone signs in: does it have an owner yet. */
export interface AccessState {
  readonly installed: boolean
  /** The password was just removed from the host machine, so the screen does not say the same thing. */
  readonly awaitingReset: boolean
  readonly minimumPasswordLength: number
}

/** The only refusal expected when changing a password: the old one does not match. */
export type PasswordChangeResult = 'changed' | 'wrong-password'

export interface CurrentSession {
  readonly role: AccountRole
  readonly expiresAt: string
}
