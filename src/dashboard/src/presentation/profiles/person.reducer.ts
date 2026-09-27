import type { PersonAction } from './person.actions'
import type { PersonUido } from './person.uido'

export function personReducer(state: PersonUido, action: PersonAction): PersonUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return {
        loading: false,
        error: null,
        person: action.people.find((entry) => entry.id === action.profileId) ?? null,
      }
    case 'LOAD_FAILED':
      return { loading: false, error: action.error, person: null }
  }
}
