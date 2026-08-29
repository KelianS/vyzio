import type { AccessState, CurrentSession } from '../entities/Access'

export interface AccessRepository {
  getState(): Promise<AccessState>

  /** `null` quand personne n'est connecte : ce n'est pas une panne, c'est l'etat courant. */
  getCurrentSession(): Promise<CurrentSession | null>

  /** Echoue si l'installation a deja un proprietaire — l'ecran de creation n'a alors plus lieu d'etre. */
  createOwner(password: string): Promise<CurrentSession>

  /** `null` quand le mot de passe est refuse : l'ecran le dit, ce n'est pas une panne. */
  signIn(password: string): Promise<CurrentSession | null>

  signOut(): Promise<void>
  signOutEverywhere(): Promise<void>
}
