import type { ToastTone } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { AccessContainer } from '../../infrastructure/providers/access.container'
import type { AccessGateAction } from './access_gate.actions'

export interface AccessGatePresenterContext {
  container: AccessContainer
  dispatch: (action: AccessGateAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildAccessGatePresenter({
  container,
  dispatch,
  toast,
}: AccessGatePresenterContext) {
  async function load() {
    dispatch({ type: 'LOAD_STARTED' })
    try {
      const state = await container.getAccessState.execute()
      const session = state.installed ? await container.getCurrentSession.execute() : null
      dispatch({ type: 'LOAD_SUCCEEDED', state, session })
    } catch (e) {
      dispatch({ type: 'LOAD_FAILED', error: toAppError(e) })
    }
  }

  return {
    onLoad: load,

    /** Listens for a session ending on whichever call comes next; returns the unsubscribe. */
    onWatchSession() {
      return container.onSessionLost(() => dispatch({ type: 'SESSION_LOST' }))
    },

    async onCreateOwner(password: string) {
      dispatch({ type: 'CREATE_STARTED' })
      try {
        await container.createOwnerAccount.execute(password)
        void load()
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'CREATE_FINISHED' })
      }
    },

    async onSignIn(password: string) {
      dispatch({ type: 'SIGN_IN_STARTED' })
      try {
        const session = await container.signIn.execute(password)
        if (session === null) dispatch({ type: 'SIGN_IN_REFUSED' })
        else void load()
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'SIGN_IN_FINISHED' })
      }
    },
  }
}
