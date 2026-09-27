import type { ToastTone } from '../../common/components/toast'
import { ApiErrorCode, AppErrorKind, toastError } from '../../common/errors/app_error'
import { scrubSecrets } from '../../common/errors/scrub_secrets'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { Camera } from '../../domain/entities/camera.entity'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocolAddition } from '../../domain/entities/camera_protocol.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { refreshSurveillance } from '../surveillance/surveillance_refresh'
import type { CameraConnectionAction } from './camera_connection.actions'
import { CapabilityTask } from './camera_connection.uido'
import { reloadCameraList, reportCameraGone } from './camera_list_reload'
import { cameraUpdate } from './camera_update'
import { CAPABILITY_LABELS, STREAM_LABEL, STREAM_REPAIR } from './cameras.formatters'
import {
  ALL_PROTOCOLS,
  protocolInputOf,
  protocolKey,
  type ConnectionValues,
} from './camera_connection_values'

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
  const nextProtocolsRead = latestOnly()

  /** The protocol boxes of Avancé; after an action a failed reread keeps them and goes to a toast. */
  function readProtocols(cameraId: string, listShown = false) {
    const isLatest = nextProtocolsRead()
    if (!listShown) dispatch({ type: 'PROTOCOLS_STARTED' })
    container.getCameraProtocols
      .execute(cameraId)
      .then((protocols) => {
        if (isLatest()) dispatch({ type: 'PROTOCOLS_LOADED', protocols })
      })
      .catch((e: unknown) => {
        if (!isLatest()) return
        const error = toAppError(e)
        if (error.kind === AppErrorKind.NotFound) reportCameraGone(container, dispatch)
        else if (listShown) toastError(toast, error)
        else dispatch({ type: 'PROTOCOLS_FAILED', error })
      })
  }

  /** Everything a test or a save can have changed: capabilities and protocols. */
  function readConnection(cameraId: string) {
    readBindings(cameraId, true)
    readProtocols(cameraId, true)
  }

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
      readConnection(cameraId)
      return result
    } catch (e) {
      const error = toAppError(e)
      toastError(toast, error)
      // A page left open offered a protocol the camera no longer has: show its protocols as they are.
      if (error.code === ApiErrorCode.ProtocolNotOnCamera) readProtocols(cameraId, true)
      return undefined
    } finally {
      dispatch({ type: 'TASK_FINISHED', capability })
    }
  }

  function announceTest(binding: CameraCapabilityBinding) {
    if (binding.verified) {
      toast(`${CAPABILITY_LABELS[binding.capability]} : connexion réussie.`, 'success')
    } else {
      // The camera's own answer goes to the diagnostic line, never into the sentence (SPECS 1.5).
      toast(
        'Connexion échouée : vérifiez l’accès réseau et les identifiants.',
        'error',
        binding.lastError ? scrubSecrets(binding.lastError) : undefined,
      )
    }
  }

  return {
    onLoad(cameraId: string) {
      readBindings(cameraId)
      readProtocols(cameraId)
    },

    /** Saves each level that changed, the camera, the stream's path, each protocol; resolves true once saved. */
    async onSave(camera: Camera, values: ConnectionValues, saved: ConnectionValues) {
      dispatch({ type: 'SAVE_STARTED' })
      try {
        const accessChanged =
          values.displayName !== saved.displayName ||
          values.host !== saved.host ||
          values.username !== saved.username ||
          values.password !== saved.password
        if (accessChanged) {
          await container.updateCamera.execute(
            camera.id,
            cameraUpdate(camera, {
              displayName: values.displayName,
              host: values.host,
              username: values.username.trim() || null,
              // An empty field keeps the saved password: sending it blank would erase it.
              password: values.password.trim() ? values.password : null,
            }),
          )
        }
        if (values.streamPath !== saved.streamPath) {
          await container.setStreamPath.execute(camera.id, values.streamPath.trim() || null)
        }
        for (const protocol of ALL_PROTOCOLS) {
          const key = protocolKey(protocol)
          if (values[key] === saved[key]) continue
          await container.updateCameraProtocol.execute(
            camera.id,
            protocol,
            protocolInputOf(values[key]),
          )
        }
        toast('Connexion enregistrée.', 'success')
        refreshSurveillance(hubContainer)
        reloadCameraList(container)
        readConnection(camera.id)
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
        const { connected, guidance } = await container.verifyCamera.execute(cameraId)
        if (connected) toast(`${STREAM_LABEL} : connexion réussie.`, 'success')
        else {
          // The verifier's own explanation names the stream's mechanics: support detail, never the sentence (SPECS 1.5).
          toast(
            `Caméra injoignable : ${STREAM_REPAIR}`,
            'error',
            guidance ? scrubSecrets(guidance) : undefined,
          )
        }
        reloadCameraList(container)
        readConnection(cameraId)
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
        readConnection(cameraId)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'DETECT_FINISHED' })
      }
    },

    /** Tests the capability through the protocol; resolves true when the camera answered. */
    async onConfigure(cameraId: string, capability: Capability, protocol: SupportedProtocol) {
      const binding = await runTask(cameraId, capability, CapabilityTask.Configure, () =>
        container.configureCameraCapability.execute(cameraId, capability, protocol),
      )
      if (!binding) return false
      announceTest(binding)
      return binding.verified
    },

    /** Runs the capability's test again on its saved protocol, without declaring anything. */
    async onVerifyCapability(cameraId: string, capability: Capability) {
      const binding = await runTask(cameraId, capability, CapabilityTask.Verify, () =>
        container.probeCameraCapability.execute(cameraId, capability),
      )
      if (binding) announceTest(binding)
    },

    async onTogglePtz(camera: Camera) {
      const enabled = camera.ptzSupported
      const done = await runTask(camera.id, 'ptz', CapabilityTask.TogglePtz, () =>
        container.updateCamera.execute(camera.id, cameraUpdate(camera, { ptzSupported: !enabled })),
      )
      if (!done) return
      toast(enabled ? 'Orientation désactivée.' : 'Orientation activée.', 'success')
      // Whether orientation is on lives on the camera, read from the shared list.
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
      if (removed) toast(`${CAPABILITY_LABELS[capability]} : capacité retirée.`, 'success')
    },

    /** Asks the camera whether one protocol answers; no capability goes through it, so nothing suspends it. */
    async onCheckProtocol(cameraId: string, protocol: SupportedProtocol) {
      dispatch({ type: 'PROTOCOL_CHECK_STARTED', protocol })
      try {
        const checked = await container.checkCameraProtocol.execute(cameraId, protocol)
        dispatch({ type: 'PROTOCOL_CHECKED', protocol: checked })
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'PROTOCOL_CHECK_FINISHED', protocol })
      }
    },

    /** The protocol level alone: the boxes gain the usual protocols that answer, no capability moves. */
    async onSearchProtocols(cameraId: string) {
      dispatch({ type: 'PROTOCOL_SEARCH_STARTED' })
      try {
        const protocols = await container.searchCameraProtocols.execute(cameraId)
        dispatch({ type: 'PROTOCOLS_LOADED', protocols })
        toast('Recherche terminée.', 'success')
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'PROTOCOL_SEARCH_FINISHED' })
      }
    },

    onOpenProtocolForm() {
      dispatch({ type: 'PROTOCOL_FORM_OPENED' })
    },
    onCloseProtocolForm() {
      dispatch({ type: 'PROTOCOL_FORM_CLOSED' })
    },

    /** Adds a protocol and checks it at once; the new box then says whether it answers. */
    async onAddProtocol(cameraId: string, addition: CameraProtocolAddition) {
      dispatch({ type: 'PROTOCOL_ADD_STARTED' })
      try {
        await container.addCameraProtocol.execute(cameraId, addition)
        toast('Protocole ajouté.', 'success')
        dispatch({ type: 'PROTOCOL_FORM_CLOSED' })
        readProtocols(cameraId, true)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'PROTOCOL_ADD_FINISHED' })
      }
    },

    async onRemoveProtocol(cameraId: string, protocol: SupportedProtocol) {
      dispatch({ type: 'PROTOCOL_REMOVE_STARTED', protocol })
      try {
        await container.removeCameraProtocol.execute(cameraId, protocol)
        toast('Protocole retiré.', 'success')
        readProtocols(cameraId, true)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'PROTOCOL_REMOVE_FINISHED', protocol })
      }
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
        readConnection(cameraId)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'MANUAL_FINISHED' })
      }
    },
  }
}
