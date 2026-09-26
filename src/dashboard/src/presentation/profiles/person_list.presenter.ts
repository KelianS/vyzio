import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import type { PersonListAction } from './person_list.actions'

export interface PersonListPresenterContext {
  container: ProfilesContainer
  dispatch: (action: PersonListAction) => void
}

export function buildPersonListPresenter({ container, dispatch }: PersonListPresenterContext) {
  return {
    onLoad() {
      container.getProfiles
        .execute()
        .then((people) => dispatch({ type: 'LOAD_SUCCEEDED', people }))
        // An unread list still reads as an empty one.
        .catch(() => dispatch({ type: 'LOAD_FAILED' }))
    },
  }
}
