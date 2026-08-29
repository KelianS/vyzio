/** Ce qu'un compte a le droit de faire (ADR-54). */
export type AccountRole = 'owner' | 'resident'

/** L'etat de l'installation avant toute connexion : a-t-elle deja un proprietaire. */
export interface AccessState {
  readonly installed: boolean
  readonly minimumPasswordLength: number
}

export interface CurrentSession {
  readonly role: AccountRole
  readonly expiresAt: string
}
