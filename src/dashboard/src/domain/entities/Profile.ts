/** Categorie d'une personne connue. Fermee : l'API n'en accepte pas d'autre. */
export type ProfileCategory = 'family' | 'friend' | 'staff' | 'other'

/** Ce que Vyzio fait quand il reconnait cette personne. */
export type ProfileAlertMode = 'always' | 'never'

export interface Profile {
  id: string
  name: string
  category: ProfileCategory
  alertMode: ProfileAlertMode
  lastSeenAt: string | null
  createdAt: string
}
