import type { ToastTone } from '../../common/components/toast'
import { AppErrorKind, toastError } from '../../common/errors/app_error'
import { scrubSecrets } from '../../common/errors/scrub_secrets'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { Camera } from '../../domain/entities/camera.entity'
import type {
  Capability,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { refreshSurveillance } from '../surveillance/surveillance_refresh'
import type { CameraConnectionAction } from './camera_connection.actions'
import { CapabilityTask } from './camera_connection.uido'
import { reloadCameraList, reportCameraGone } from './camera_list_reload'
import { cameraUpdate } from './camera_update'
import { CAPABILITY_LABELS } from './cameras.formatters'

export interface ConnectionValues {
  displayName: string
  host: string
  port: number
  streamPath: string
  username: string
  password: string
}

export interface CameraConnectionPresenterContext {
  container: CamerasContainer
  hubContainer: HubContainer
  dispatch: (action: CameraConnectionAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildCameraConnectionPresenter({
  container,
  hubContainer,
  dispatch,
  toast,
}: CameraConnectionPresenterContext) {
  // Moving to another camera keeps the tab mounted: only the latest read may answer.
  const nextBindingsRead = latestOnly()

  /** After an action the list is already shown: a failed reread keeps it and goes to a toast (DESIGN SYSTEM § Errors). */
  function readBindings(cameraId: string, listShown = false) {
    const isLatest = nextBindingsRead()
    if (!listShown) dispatch({ type: 'BINDINGS_STARTED' })
    container.getCameraCapabilities
      .execute(cameraId)
      .then((bindings) => {
        if (isLatest()) dispatch({ type: 'BINDINGS_LOADED', bindings })
      })
      .catch((e: unknown) => {
        if (!isLatest()) return
        const error = toAppError(e)
        if (error.kind === AppErrorKind.NotFound) reportCameraGone(container, dispatch)
        else if (listShown) toastError(toast, error)
        else dispatch({ type: 'BINDINGS_FAILED', error })
      })
  }

  /** Runs one capability action, then reads the capabilities again; resolves undefined on failure. */
  async function runTask<T>(
    cameraId: string,
    capability: Capability,
    task: CapabilityTask,
    work: () => Promise<T>,
  ): Promise<T | undefined> {
    dispatch({ type: 'TASK_STARTED', capability, task })
    try {
      const result = await work()
      readBindings(cameraId, true)
      return result
    } catch (e) {
      toastError(toast, toAppError(e))
      return undefined
    } finally {
      dispatch({ type: 'TASK_FINISHED', capability })
    }
  }

  return {
    onLoad(cameraId: string) {
      readBindings(cameraId)
    },

    /** Resolves true once saved, so the view clears its draft. */
    async onSave(camera: Camera, values: ConnectionValues) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        await container.updateCamera.execute(
          camera.id,
          cameraUpdate(camera, {
            displayName: values.displayName,
            host: values.host,
            port: values.port,
            streamPath: values.streamPath.trim() || null,
            username: values.username.trim() || null,
            // An empty field keeps the saved password: sending it blank would erase it.
            password: values.password.trim() ? values.password : null,
          }),
        )
        toast('Connexion enregistrée.', 'success')
        refreshSurveillance(hubContainer)
        reloadCameraList(container)
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'SAVE_FINISHED' })
      }
    },

    async onVerify(cameraId: string) {
      dispatch({ type: 'VERIFY_STARTED' })
      try {
        const { connected } = await container.verifyCamera.execute(cameraId)
        toast(
          connected ? 'Caméra joignable.' : 'Caméra injoignable : vérifiez ces réglages.',
          connected ? 'success' : 'error',
        )
        reloadCameraList(container)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'VERIFY_FINISHED' })
      }
    },

    onAskDelete() {
      dispatch({ type: 'DELETE_ASKED' })
    },
    onCancelDelete() {
      dispatch({ type: 'DELETE_CANCELLED' })
    },

    /** Resolves true once deleted, so the view leaves for the camera list. */
    async onDelete(cameraId: string) {
      dispatch({ type: 'DELETE_STARTED' })
      try {
        const { message } = await container.deleteCamera.execute(cameraId)
        toast(message ?? 'Caméra supprimée.', 'info')
        reloadCameraList(container)
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'DELETE_FINISHED' })
      }
    },

    async onDetect(cameraId: string) {
      dispatch({ type: 'DETECT_STARTED' })
      try {
        await container.detectCameraCapabilities.execute(cameraId)
        toast('Détection terminée.', 'success')
        readBindings(cameraId, true)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'DETECT_FINISHED' })
      }
    },

    /** Tests the capability through the protocol; resolves true when the camera answered. */
    async onConfigure(
      cameraId: string,
      capability: Capability,
      protocol: SupportedProtocol,
      configJson?: string,
    ) {
      const binding = await runTask(cameraId, capability, CapabilityTask.Configure, () =>
        container.configureCameraCapability.execute(cameraId, capability, protocol, configJson),
      )
      if (!binding) return false
      if (binding.verified) {
        toast(`${CAPABILITY_LABELS[capability]} : connexion réussie.`, 'success')
      } else {
        // The camera's own answer goes to the diagnostic line, never into the sentence (SPECS 1.5).
        toast(
          'Connexion échouée : vérifiez l’accès réseau et les identifiants.',
          'error',
          binding.lastError ? scrubSecrets(binding.lastError) : undefined,
        )
      }
      return binding.verified
    },

    async onTogglePtz(camera: Camera) {
      const enabled = camera.ptzSupported
      const done = await runTask(camera.id, 'ptz', CapabilityTask.TogglePtz, () =>
        container.updateCamera.execute(camera.id, cameraUpdate(camera, { ptzSupported: !enabled })),
      )
      if (!done) return
      toast(enabled ? 'PTZ désactivé.' : 'PTZ activé.', 'success')
      // Whether PTZ is on lives on the camera, read from the shared list.
      reloadCameraList(container)
    },

    async onSetPanInverted(cameraId: string, inverted: boolean) {
      const saved = await runTask(cameraId, 'ptz', CapabilityTask.SetPanInverted, () =>
        container.setPtzPanInverted.execute(cameraId, inverted),
      )
      if (!saved) return
      toast(
        saved.panInverted ? 'Gauche et droite inversés.' : 'Sens gauche et droite rétabli.',
        'success',
      )
    },

    async onRemove(cameraId: string, capability: Capability) {
      const removed = await runTask(cameraId, capability, CapabilityTask.Remove, async () => {
        await container.removeCameraCapability.execute(cameraId, capability)
        return true
      })
      if (removed) toast(`${CAPABILITY_LABELS[capability]} retiré.`, 'success')
    },

    onOpenManual() {
      dispatch({ type: 'MANUAL_OPENED' })
    },
    onCloseManual() {
      dispatch({ type: 'MANUAL_CLOSED' })
    },

    async onConfigureManually(
      cameraId: string,
      capability: Capability,
      protocol: SupportedProtocol,
    ) {
      dispatch({ type: 'MANUAL_STARTED' })
      try {
        await container.configureCameraCapability.execute(cameraId, capability, protocol)
        dispatch({ type: 'MANUAL_CLOSED' })
        readBindings(cameraId, true)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'MANUAL_FINISHED' })
      }
    },
  }
}
