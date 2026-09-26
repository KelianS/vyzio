import { useCallback, useEffect } from 'react'
import { useToast } from '../../common/components/Toast'
import { toastError } from '../../common/errors/AppError'
import { useAppContainer } from '../../infrastructure/providers/AppContainerContext'
import { useRootStore } from '../../infrastructure/store/rootStore'

/** Reads the shared camera list again, for a screen offering to retry a failed read. */
export function useReloadCameraList() {
  const { cameras } = useAppContainer()
  return useCallback(
    () => void useRootStore.getState().loadCameras(cameras.getCameras),
    [cameras.getCameras],
  )
}

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
