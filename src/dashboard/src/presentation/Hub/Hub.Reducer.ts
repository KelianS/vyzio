import type { HubAction } from './Hub.Actions'
import type { HubUido } from './Hub.Uido'

export function hubReducer(state: HubUido, action: HubAction): HubUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, data: action.data }
    case 'LOAD_FAILED':
      return { ...state, loading: false, error: action.error }
    case 'PRIVACY_PENDING_SET':
      return { ...state, privacyPending: action.request }
    case 'PRIVACY_TOGGLE_STARTED':
      return { ...state, privacyLoading: true }
    case 'PRIVACY_TOGGLE_SUCCEEDED':
      return { ...state, privacyLoading: false, privacyPending: null }
    case 'PRIVACY_TOGGLE_FAILED':
      // The request stays on screen: the user sees what the error is about, and can try again.
      return { ...state, privacyLoading: false }
  }
}
