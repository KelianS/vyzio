import { useEffect } from 'react'
import { useToast } from '../../common/components/toast'
import { toastError } from '../../common/errors/app_error'
import { useRootStore } from '../../infrastructure/store/root.store'

/** A reload that fails keeps the list already shown, so the failure goes to a toast (SPECS 1.5). */
export function useCameraListFailureToast() {
  const { toast } = useToast()

  useEffect(
    () =>
      useRootStore.subscribe((state, previous) => {
        // With no list to keep, the screen shows the failure in place instead.
        if (state.camerasError && !previous.camerasError && state.cameras.length > 0)
          toastError(toast, state.camerasError)
      }),
    [toast],
  )
}
