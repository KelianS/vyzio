import type { PersonCamerasAction } from './person_cameras.actions'
import type { PersonCamerasUido } from './person_cameras.uido'

export function personCamerasReducer(
  state: PersonCamerasUido,
  action: PersonCamerasAction,
): PersonCamerasUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, links: action.links }
    case 'LOAD_FAILED':
      return { ...state, loading: false, links: null }
    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }
  }
}
