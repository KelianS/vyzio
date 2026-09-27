import { toAppError } from '../../common/errors/to_app_error'
import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import type { PersonListAction } from './person_list.actions'

export interface PersonListPresenterContext {
  container: ProfilesContainer
  dispatch: (action: PersonListAction) => void
}

export function buildPersonListPresenter({ container, dispatch }: PersonListPresenterContext) {
  return {
    onLoad() {
      dispatch({ type: 'LOAD_STARTED' })
      container.getProfiles
        .execute()
        .then((people) => dispatch({ type: 'LOAD_SUCCEEDED', people }))
        .catch((e: unknown) => dispatch({ type: 'LOAD_FAILED', error: toAppError(e) }))
    },
  }
}
