import { appErrorDiagnostic, appErrorMessage } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { useRootStore } from '../../infrastructure/store/root.store'

export interface RestartSurveillancePresenterContext {
  camerasContainer: CamerasContainer
  hubContainer: HubContainer
}

// Restarting the surveillance (ADR-44): its state is shared, the header trigger and the guard both show it.
export function buildRestartSurveillancePresenter({
  camerasContainer,
  hubContainer,
}: RestartSurveillancePresenterContext) {
  return {
    async onRestart(): Promise<void> {
      const store = useRootStore.getState()
      store.setRestarting(true)
      store.setRestartFailure(null)

      try {
        const result = await camerasContainer.restartSurveillance.execute()
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
        await useRootStore.getState().loadSystemStats(hubContainer.getSystemStats)
      }
    },
  }
}
