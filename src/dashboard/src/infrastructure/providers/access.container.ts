import { ChangePassword } from '../../domain/usecases/change_password.use_case'
import { CreateOwnerAccount } from '../../domain/usecases/create_owner_account.use_case'
import { GetAccessState } from '../../domain/usecases/get_access_state.use_case'
import { GetCurrentSession } from '../../domain/usecases/get_current_session.use_case'
import { SignIn } from '../../domain/usecases/sign_in.use_case'
import { SignOut } from '../../domain/usecases/sign_out.use_case'
import { SignOutEverywhere } from '../../domain/usecases/sign_out_everywhere.use_case'
import type { AccessRepository } from '../../domain/ports/access.port'
import { onSessionLost } from '../http/session_lost'

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
