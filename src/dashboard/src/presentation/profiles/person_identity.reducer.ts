import type { PersonIdentityAction } from './person_identity.actions'
import type { PersonIdentityUido } from './person_identity.uido'

export function personIdentityReducer(
  state: PersonIdentityUido,
  action: PersonIdentityAction,
): PersonIdentityUido {
  switch (action.type) {
    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }
    case 'DELETE_ASKED':
      return { ...state, confirmDelete: true }
    case 'DELETE_CANCELLED':
      return { ...state, confirmDelete: false }
    case 'DELETE_STARTED':
      return { ...state, deleting: true }
    // Success or failure, the question has been answered.
    case 'DELETE_FINISHED':
      return { ...state, deleting: false, confirmDelete: false }
  }
}
