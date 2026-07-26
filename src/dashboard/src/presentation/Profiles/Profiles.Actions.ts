import type { Profile } from '../../domain/entities/Profile'
import type { ProfileDetailTab } from './Profiles.Uido'

export type ProfilesAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; profiles: Profile[] }
  | { type: 'LOAD_FAILED' }
  | { type: 'SELECTED'; id: string }
  | { type: 'NEW_REQUESTED' }
  | { type: 'CREATING_CANCELLED' }
  | { type: 'TAB_SET'; tab: ProfileDetailTab }
  | { type: 'CREATE_SUCCEEDED'; profile: Profile }
  | { type: 'UPDATE_SUCCEEDED'; profile: Profile }
  | { type: 'DELETE_SUCCEEDED'; id: string }
  | { type: 'RESYNC_STARTED' }
  | { type: 'RESYNC_SUCCEEDED'; count: number }
  | { type: 'RESYNC_FAILED' }
  | { type: 'CONFIRM_DELETE_SET'; id: string | null }
  | { type: 'CONFIRM_RESYNC_SET'; value: boolean }
