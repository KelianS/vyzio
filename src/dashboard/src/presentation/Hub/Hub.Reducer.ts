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
    case 'BATCH_PENDING_SET':
      return { ...state, batchPending: action.value }
    case 'BATCH_TOGGLE_STARTED':
      return { ...state, batchToggleLoading: true }
    case 'BATCH_TOGGLE_SUCCEEDED':
      return { ...state, batchToggleLoading: false, batchPending: null }
    case 'BATCH_TOGGLE_FAILED':
      return { ...state, batchToggleLoading: false }
  }
}
