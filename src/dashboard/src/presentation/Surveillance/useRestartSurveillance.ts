import { useCallback } from 'react'
import { appErrorDiagnostic, appErrorMessage } from '../../common/errors/AppError'
import { toAppError } from '../../common/errors/toAppError'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'

// Restarting the surveillance (ADR-44): an installation act, triggered by the user.
export function useRestartSurveillance() {
  const { cameras: container, hub } = useAppContainer()
  const restarting = useRootStore((state) => state.restarting)
  const failure = useRootStore((state) => state.restartFailure)
  const pending = useRootStore((state) => state.systemStats?.pendingChanges ?? false)

  const restart = useCallback(async () => {
    const store = useRootStore.getState()
    store.setRestarting(true)
    store.setRestartFailure(null)

    try {
      const result = await container.restartSurveillance.execute()
      store.setRestartFailure(result.applied ? null : { message: result.message })
    } catch (error) {
      const appError = toAppError(error)
      store.setRestartFailure({
        message: appErrorMessage(appError),
        diagnostic: appErrorDiagnostic(appError),
      })
    } finally {
      store.setRestarting(false)
      // Re-read rather than infer: a success empties the wait, a failure leaves it.
      await useRootStore.getState().loadSystemStats(hub.getSystemStats)
    }
  }, [container, hub])

  return { pending, restarting, failure, restart }
}
