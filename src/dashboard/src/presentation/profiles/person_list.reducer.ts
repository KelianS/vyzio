import type { PersonListAction } from './person_list.actions'
import type { PersonListUido } from './person_list.uido'

export function personListReducer(state: PersonListUido, action: PersonListAction): PersonListUido {
  switch (action.type) {
    case 'LOAD_SUCCEEDED':
      return { ...state, people: action.people, loading: false }
    case 'LOAD_FAILED':
      return { ...state, people: [], loading: false }
  }
}
