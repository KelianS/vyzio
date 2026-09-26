import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { AccessContainer } from '../../infrastructure/providers/access.container'
import type { AccessAction } from './access.actions'

export interface AccessPresenterContext {
  container: AccessContainer
  dispatch: (action: AccessAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildAccessPresenter({ container, dispatch, toast }: AccessPresenterContext) {
  return {
    onLoad() {
      container.getAccessState
        .execute()
        .then((state) =>
          dispatch({ type: 'MIN_LENGTH_LOADED', minLength: state.minimumPasswordLength }),
        )
        // Unread, the rule is still left to the server, which refuses a password too short.
        .catch(() => undefined)
    },

    /** Resolves true once changed, so the view clears the fields. */
    async onChangePassword(current: string, next: string) {
      dispatch({ type: 'CHANGE_STARTED' })
      try {
        const result = await container.changePassword.execute(current, next)
        switch (result) {
          case 'wrong-password':
            dispatch({ type: 'CHANGE_REFUSED' })
            return false
          case 'changed':
            toast('Mot de passe changé. Les autres appareils ont été déconnectés.', 'success')
            return true
          default: {
            const unhandled: never = result
            return unhandled
          }
        }
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'CHANGE_FINISHED' })
      }
    },

    /** Resolves true once signed out: the view then closes the door by reloading. */
    async onSignOut() {
      dispatch({ type: 'LEAVE_STARTED' })
      try {
        await container.signOut.execute()
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'LEAVE_FINISHED' })
      }
    },

    onAskSignOutEverywhere() {
      dispatch({ type: 'EVERYWHERE_ASKED' })
    },
    onCancelSignOutEverywhere() {
      dispatch({ type: 'EVERYWHERE_CLOSED' })
    },
    /** Resolves true once every session is closed, this one included. */
    async onSignOutEverywhere() {
      dispatch({ type: 'EVERYWHERE_CLOSED' })
      dispatch({ type: 'LEAVE_EVERYWHERE_STARTED' })
      try {
        await container.signOutEverywhere.execute()
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'LEAVE_EVERYWHERE_FINISHED' })
      }
    },
  }
}
