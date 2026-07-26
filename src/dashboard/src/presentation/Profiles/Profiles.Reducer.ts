import type { ProfilesAction } from './Profiles.Actions'
import type { ProfilesUido } from './Profiles.Uido'

export function profilesReducer(state: ProfilesUido, action: ProfilesAction): ProfilesUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, profiles: action.profiles }
    case 'LOAD_FAILED':
      return { ...state, loading: false, error: 'Impossible de charger les profils.' }

    case 'SELECTED':
      return { ...state, selectedId: action.id, creating: false, tab: 'info' }
    case 'NEW_REQUESTED':
      return { ...state, selectedId: null, creating: true, tab: 'info' }
    case 'CREATING_CANCELLED':
      return { ...state, creating: false }
    case 'TAB_SET':
      return { ...state, tab: action.tab }

    case 'CREATE_SUCCEEDED':
      return {
        ...state,
        profiles: [...state.profiles, action.profile],
        selectedId: action.profile.id,
        creating: false,
      }
    case 'UPDATE_SUCCEEDED':
      return {
        ...state,
        profiles: state.profiles.map((p) => (p.id === action.profile.id ? action.profile : p)),
      }
    case 'DELETE_SUCCEEDED':
      return {
        ...state,
        profiles: state.profiles.filter((p) => p.id !== action.id),
        selectedId: null,
        creating: false,
        confirmDeleteProfileId: null,
      }

    case 'RESYNC_STARTED':
      return { ...state, resyncLoading: true, resyncMessage: null }
    case 'RESYNC_SUCCEEDED':
      return {
        ...state,
        resyncLoading: false,
        resyncMessage: `${action.count} visage(s) synchronisé(s).`,
      }
    case 'RESYNC_FAILED':
      return { ...state, resyncLoading: false, resyncMessage: 'Erreur lors de la synchronisation.' }

    case 'CONFIRM_DELETE_SET':
      return { ...state, confirmDeleteProfileId: action.id }
    case 'CONFIRM_RESYNC_SET':
      return { ...state, confirmResync: action.value }
  }
}
