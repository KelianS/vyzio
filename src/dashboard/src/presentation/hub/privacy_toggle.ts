import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { ToastTone } from '../../common/components/toast'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import { useRootStore } from '../../infrastructure/store/root.store'

/** Cuts or resumes cameras at once, no confirmation (PRIV-21): the card's own change is the answer. */
export async function setCamerasPrivacy(
  camerasContainer: CamerasContainer,
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void,
  cameraIds: readonly string[],
  active: boolean,
): Promise<void> {
  try {
    await camerasContainer.batchToggleCameraPrivacyMode.execute([...cameraIds], active)
  } catch (e) {
    toastError(toast, toAppError(e))
  } finally {
    // A batch that stopped part way has still switched the cameras before the failing one.
    // Awaited: the eye stays busy until the card can show the new state.
    await useRootStore.getState().loadCameras(camerasContainer.getCameras)
  }
}
