/** The category of a known person. Closed: the API accepts no other. */
export type ProfileCategory = 'family' | 'friend' | 'staff' | 'other'

/** What Vyzio does when it recognises this person. */
export type ProfileAlertMode = 'always' | 'never'

export interface Profile {
  id: string
  name: string
  category: ProfileCategory
  alertMode: ProfileAlertMode
  lastSeenAt: string | null
  createdAt: string
}
