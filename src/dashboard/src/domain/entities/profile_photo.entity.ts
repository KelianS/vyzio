export interface ProfilePhoto {
  id: string
  profileId: string
  filename: string
  frigateSynced: boolean
  syncedAt: string | null
  createdAt: string
}
