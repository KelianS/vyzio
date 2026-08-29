import { CreateOwnerAccount } from '../../domain/usecases/CreateOwnerAccount'
import { GetAccessState } from '../../domain/usecases/GetAccessState'
import { GetCurrentSession } from '../../domain/usecases/GetCurrentSession'
import { SignIn } from '../../domain/usecases/SignIn'
import { SignOut } from '../../domain/usecases/SignOut'
import { SignOutEverywhere } from '../../domain/usecases/SignOutEverywhere'
import type { AccessRepository } from '../../domain/ports/AccessRepository'

export interface AccessContainer {
  getAccessState: GetAccessState
  getCurrentSession: GetCurrentSession
  createOwnerAccount: CreateOwnerAccount
  signIn: SignIn
  signOut: SignOut
  signOutEverywhere: SignOutEverywhere
}

export function makeAccessContainer(repository: AccessRepository): AccessContainer {
  return {
    getAccessState: new GetAccessState(repository),
    getCurrentSession: new GetCurrentSession(repository),
    createOwnerAccount: new CreateOwnerAccount(repository),
    signIn: new SignIn(repository),
    signOut: new SignOut(repository),
    signOutEverywhere: new SignOutEverywhere(repository),
  }
}
