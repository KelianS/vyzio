import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { Toast } from '../../common/components/toast'
import { privacyMissNotice } from '../../common/privacy/privacy_status'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import { useRootStore } from '../../infrastructure/store/root.store'

/** Cuts or resumes cameras at once, no confirmation (PRIV-21): the card's own change is the answer. */
export function setCamerasPrivacy(
  camerasContainer: CamerasContainer,
  toast: Toast,
  cameraIds: readonly string[],
  active: boolean,
): Promise<void> {
  return actOnPrivacy(camerasContainer, toast, cameraIds, () =>
    camerasContainer.batchToggleCameraPrivacyMode.execute([...cameraIds], active),
  )
}

/**
 * Runs the user's own privacy act, then tells in a toast what each camera did not follow (PRIV-05).
 * A batch that stopped part way has still switched the cameras before the failing one, so the list is read again.
 */
export async function actOnPrivacy(
  camerasContainer: CamerasContainer,
  toast: Toast,
  cameraIds: readonly string[],
  act: () => Promise<unknown>,
): Promise<void> {
  const store = useRootStore.getState()
  store.privacyActStarted(cameraIds)
  try {
    await act()
  } catch (e) {
    toastError(toast, toAppError(e))
  } finally {
    // Awaited: the eye stays busy until the card can show the new state.
    await store.loadCameras(camerasContainer.getCameras)
  }
  const cameras = useRootStore.getState().cameras.filter((camera) => cameraIds.includes(camera.id))
  const told: string[] = []
  for (const camera of cameras) {
    const notice = privacyMissNotice(camera)
    if (!notice) continue
    told.push(notice.key)
    toast(
      notice.missing ? `${notice.title}, ${notice.missing}.` : `${notice.title}.`,
      'error',
      notice.diagnostic ?? undefined,
      notice.retry
        ? {
            label: 'Réessayer',
            onClick: () => void askAgain(camerasContainer, toast, camera.id, camera.displayName),
          }
        : undefined,
    )
  }
  useRootStore.getState().privacyActEnded(cameraIds, told)
}

/** Asks the camera again for the state it already holds, without changing who set it (PRIV-05). */
async function askAgain(
  camerasContainer: CamerasContainer,
  toast: Toast,
  cameraId: string,
  name: string,
): Promise<void> {
  let followed = false
  await actOnPrivacy(camerasContainer, toast, [cameraId], async () => {
    const camera = await camerasContainer.retryCameraPrivacy.execute(cameraId)
    followed = camera.privacyMiss === null
  })
  if (followed) toast(`${name} : la caméra a suivi.`, 'success')
}
