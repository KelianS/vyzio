import { useEffect } from 'react'
import { useToast } from '../../common/components/Toast'
import { toastError } from '../../common/errors/AppError'
import { useRootStore } from '../../infrastructure/store/rootStore'

/** A reload that fails keeps the list already shown, so the failure goes to a toast (SPECS 1.5). */
export function useCameraListFailureToast() {
  const { toast } = useToast()

  useEffect(
    () =>
      useRootStore.subscribe((state, previous) => {
        // An empty list shows the failure in place instead (Hub, camera list).
        if (state.camerasError && !previous.camerasError && state.cameras.length > 0)
          toastError(toast, state.camerasError)
      }),
    [toast],
  )
}
