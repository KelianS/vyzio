import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import type { PersonAction } from './person.actions'

export interface PersonPresenterContext {
  container: ProfilesContainer
  dispatch: (action: PersonAction) => void
}

export function buildPersonPresenter({ container, dispatch }: PersonPresenterContext) {
  // Moving to another person keeps the shell mounted: only the latest read may answer.
  const nextLoad = latestOnly()

  return {
    onLoad(profileId: string) {
      const isLatest = nextLoad()
      dispatch({ type: 'LOAD_STARTED' })
      container.getProfiles
        .execute()
        .then((people) => {
          if (isLatest()) dispatch({ type: 'LOAD_SUCCEEDED', people, profileId })
        })
        .catch((e: unknown) => {
          if (isLatest()) dispatch({ type: 'LOAD_FAILED', error: toAppError(e) })
        })
    },
  }
}
