import type { ConservationAction } from './conservation.actions'
import type { ConservationUido } from './conservation.uido'

export function conservationReducer(
  state: ConservationUido,
  action: ConservationAction,
): ConservationUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, settings: action.settings }
    case 'LOAD_FAILED':
      return { ...state, loading: false, settings: null, error: action.error }
    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }
  }
}
