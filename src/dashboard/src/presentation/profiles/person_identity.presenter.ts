import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { Profile } from '../../domain/entities/profile.entity'
import type { UpdateProfileRequest } from '../../domain/ports/profile.port'
import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import type { PersonIdentityAction } from './person_identity.actions'

export interface PersonIdentityPresenterContext {
  container: ProfilesContainer
  dispatch: (action: PersonIdentityAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildPersonIdentityPresenter({
  container,
  dispatch,
  toast,
}: PersonIdentityPresenterContext) {
  return {
    /** Resolves true once saved, so the view clears its draft and the shell reads the name again. */
    async onSave(personId: string, values: UpdateProfileRequest) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        await container.updateProfile.execute(personId, values)
        toast('Identité enregistrée.', 'success')
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'SAVE_FINISHED' })
      }
    },

    onAskDelete() {
      dispatch({ type: 'DELETE_ASKED' })
    },
    onCancelDelete() {
      dispatch({ type: 'DELETE_CANCELLED' })
    },

    /** Resolves true once deleted, so the view leaves for the list. */
    async onDelete(person: Profile) {
      dispatch({ type: 'DELETE_STARTED' })
      try {
        await container.deleteProfile.execute(person.id)
        toast(`« ${person.name} » supprimée.`, 'info')
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'DELETE_FINISHED' })
      }
    },
  }
}
