import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { ProfileAlertMode, ProfileCategory } from '../../domain/entities/profile.entity'
import type { CreateProfileRequest } from '../../domain/ports/profile.port'
import type { ProfilesContainer } from '../../infrastructure/providers/profiles.container'
import type { AddPersonAction } from './add_person.actions'

export interface AddPersonPresenterContext {
  container: ProfilesContainer
  dispatch: (action: AddPersonAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildAddPersonPresenter({ container, dispatch, toast }: AddPersonPresenterContext) {
  return {
    onNameChange(name: string) {
      dispatch({ type: 'NAME_SET', name })
    },
    onCategoryChange(category: ProfileCategory) {
      dispatch({ type: 'CATEGORY_SET', category })
    },
    onAlertModeChange(alertMode: ProfileAlertMode) {
      dispatch({ type: 'ALERT_MODE_SET', alertMode })
    },

    /** Resolves the new person's id, so the view opens their photos; null on failure. */
    async onCreate(form: CreateProfileRequest) {
      dispatch({ type: 'CREATE_STARTED' })
      try {
        const person = await container.createProfile.execute({ ...form, name: form.name.trim() })
        toast(`« ${person.name} » ajoutée.`, 'success')
        return person.id
      } catch (e) {
        toastError(toast, toAppError(e))
        return null
      } finally {
        dispatch({ type: 'CREATE_FINISHED' })
      }
    },
  }
}
