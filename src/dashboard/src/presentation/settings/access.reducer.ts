import type { AccessAction } from './access.actions'
import type { AccessUido } from './access.uido'

export function accessReducer(state: AccessUido, action: AccessAction): AccessUido {
  switch (action.type) {
    case 'MIN_LENGTH_LOADED':
      return { ...state, minLength: action.minLength }
    case 'CHANGE_STARTED':
      return { ...state, changing: true, refused: false }
    case 'CHANGE_REFUSED':
      return { ...state, refused: true }
    case 'CHANGE_FINISHED':
      return { ...state, changing: false }
    case 'EVERYWHERE_ASKED':
      return { ...state, confirmEverywhere: true }
    case 'EVERYWHERE_CLOSED':
      return { ...state, confirmEverywhere: false }
    case 'LEAVE_STARTED':
      return { ...state, leaving: true }
    case 'LEAVE_FINISHED':
      return { ...state, leaving: false }
    case 'LEAVE_EVERYWHERE_STARTED':
      return { ...state, leavingEverywhere: true }
    case 'LEAVE_EVERYWHERE_FINISHED':
      return { ...state, leavingEverywhere: false }
  }
}
