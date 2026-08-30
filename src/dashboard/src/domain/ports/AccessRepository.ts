import type { AccessState, CurrentSession, PasswordChangeResult } from '../entities/Access'

export interface AccessRepository {
  getState(): Promise<AccessState>

  /** `null` when nobody is signed in: that is the current state, not a failure. */
  getCurrentSession(): Promise<CurrentSession | null>

  /** Throws once the installation has an owner: the creation screen no longer has a reason to exist. */
  createOwner(password: string): Promise<CurrentSession>

  /** `null` when the password is refused: the screen says so, it is not a failure. */
  signIn(password: string): Promise<CurrentSession | null>

  /** Closes every device on the way: the old password must stop opening anything. */
  changePassword(currentPassword: string, newPassword: string): Promise<PasswordChangeResult>

  signOut(): Promise<void>
  signOutEverywhere(): Promise<void>
}
