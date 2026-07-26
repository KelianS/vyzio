import type { Profile } from '../../domain/entities/Profile'

export type ProfileDetailTab = 'info' | 'photos' | 'cameras'

export interface ProfilesUido {
  profiles: Profile[]
  loading: boolean
  error: string | null
  selectedId: string | null
  tab: ProfileDetailTab
  creating: boolean
  resyncMessage: string | null
  resyncLoading: boolean
  confirmDeleteProfileId: string | null
  confirmResync: boolean
}

export function buildInitialProfilesUido(): ProfilesUido {
  return {
    profiles: [],
    loading: true,
    error: null,
    selectedId: null,
    tab: 'info',
    creating: false,
    resyncMessage: null,
    resyncLoading: false,
    confirmDeleteProfileId: null,
    confirmResync: false,
  }
}
