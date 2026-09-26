import { ChangePassword } from '../../domain/usecases/ChangePassword'
import { CreateOwnerAccount } from '../../domain/usecases/CreateOwnerAccount'
import { GetAccessState } from '../../domain/usecases/GetAccessState'
import { GetCurrentSession } from '../../domain/usecases/GetCurrentSession'
import { SignIn } from '../../domain/usecases/SignIn'
import { SignOut } from '../../domain/usecases/SignOut'
import { SignOutEverywhere } from '../../domain/usecases/SignOutEverywhere'
import type { AccessRepository } from '../../domain/ports/AccessRepository'
import { onSessionLost } from '../http/sessionLost'

export interface AccessContainer {
  getAccessState: GetAccessState
  getCurrentSession: GetCurrentSession
  createOwnerAccount: CreateOwnerAccount
  signIn: SignIn
  changePassword: ChangePassword
  signOut: SignOut
  signOutEverywhere: SignOutEverywhere
  /** Subscribes to a session ending while a screen is open (ADR-54); returns the unsubscribe. */
  onSessionLost: (listener: () => void) => () => void
}

export function makeAccessContainer(repository: AccessRepository): AccessContainer {
  return {
    getAccessState: new GetAccessState(repository),
    getCurrentSession: new GetCurrentSession(repository),
    createOwnerAccount: new CreateOwnerAccount(repository),
    signIn: new SignIn(repository),
    changePassword: new ChangePassword(repository),
    signOut: new SignOut(repository),
    signOutEverywhere: new SignOutEverywhere(repository),
    onSessionLost,
  }
}
