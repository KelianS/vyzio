import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import type { ProfilesAction } from './Profiles.Actions'

export interface ProfilesPresenterContext {
  container: ProfilesContainer
  dispatch: (action: ProfilesAction) => void
}

export function buildProfilesPresenter({ container, dispatch }: ProfilesPresenterContext) {
  return {
    onMount() {
      dispatch({ type: 'LOAD_STARTED' })
      container.getProfiles
        .execute()
        .then((profiles) => dispatch({ type: 'LOAD_SUCCEEDED', profiles }))
        .catch(() => dispatch({ type: 'LOAD_FAILED' }))
    },

    onSelect(id: string) {
      dispatch({ type: 'SELECTED', id })
    },

    onNew() {
      dispatch({ type: 'NEW_REQUESTED' })
    },

    onCreatingCancelled() {
      dispatch({ type: 'CREATING_CANCELLED' })
    },

    onTabSet(tab: 'info' | 'photos' | 'cameras') {
      dispatch({ type: 'TAB_SET', tab })
    },

    async onCreate(name: string, category: string, alertMode: string): Promise<void> {
      const profile = await container.createProfile.execute({ name, category, alertMode })
      dispatch({ type: 'CREATE_SUCCEEDED', profile })
    },

    async onUpdate(id: string, name: string, category: string, alertMode: string): Promise<void> {
      const profile = await container.updateProfile.execute(id, { name, category, alertMode })
      dispatch({ type: 'UPDATE_SUCCEEDED', profile })
    },

    async onDelete(id: string): Promise<void> {
      await container.deleteProfile.execute(id)
      dispatch({ type: 'DELETE_SUCCEEDED', id })
    },

    async onResync(): Promise<void> {
      dispatch({ type: 'RESYNC_STARTED' })
      try {
        const count = await container.resyncFaceLibrary.execute()
        dispatch({ type: 'RESYNC_SUCCEEDED', count })
      } catch {
        dispatch({ type: 'RESYNC_FAILED' })
      }
    },

    onConfirmDeleteSet(id: string | null) {
      dispatch({ type: 'CONFIRM_DELETE_SET', id })
    },

    onConfirmResyncSet(value: boolean) {
      dispatch({ type: 'CONFIRM_RESYNC_SET', value })
    },
  }
}

export type ProfilesPresenter = ReturnType<typeof buildProfilesPresenter>
