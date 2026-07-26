import { appErrorMessage } from '../../common/errors/AppError'
import { toAppError } from '../../common/errors/toAppError'
import type { ToastTone } from '../../common/components/Toast'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { Camera } from '../../domain/entities/Camera'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { CamerasAction } from './Cameras.Actions'
import type { CameraSelection } from './Cameras.Uido'

export interface CamerasPresenterContext {
  container: CamerasContainer
  dispatch: (action: CamerasAction) => void
  toast: (message: string, tone?: ToastTone) => void
}

export function buildCamerasPresenter({ container, dispatch, toast }: CamerasPresenterContext) {
  function reloadCameras() {
    void useRootStore.getState().loadCameras(container.getCameras)
  }

  async function loadAllDetectionLabels(): Promise<void> {
    try {
      const labels = await container.getCameraLabels.execute()
      dispatch({ type: 'ALL_DETECTION_LABELS_LOADED', labels })
    } catch (e) {
      toast(appErrorMessage(toAppError(e)), 'error')
    }
  }

  return {
    onMount() {
      reloadCameras()
      void loadAllDetectionLabels()
    },

    onFormChanged(patch: Partial<CameraDraftInput>) {
      dispatch({ type: 'FORM_UPDATED', patch })
    },

    onEditFormChanged(patch: Partial<CameraDraftInput>) {
      dispatch({ type: 'EDIT_FORM_UPDATED', patch })
    },

    onEditPasswordChanged(value: string) {
      dispatch({ type: 'EDIT_PASSWORD_CHANGED', value })
    },

    onSelectManualEntry() {
      dispatch({ type: 'MANUAL_ENTRY_SELECTED' })
    },

    onSelectDiscoveryCandidate(index: number, candidate: DiscoveredCamera) {
      dispatch({ type: 'CANDIDATE_SELECTED', index, candidate })
    },

    onSelectCamera(cameraId: string) {
      dispatch({ type: 'CAMERA_SELECTED', cameraId })
    },

    onDvripModeToggle(enabled: boolean, selectedCandidate: DiscoveredCamera | null) {
      dispatch({
        type: 'DVRIP_MODE_TOGGLED',
        enabled,
        fallbackPort: selectedCandidate?.port ?? 554,
        fallbackStreamPath: selectedCandidate?.streamPath ?? null,
      })
    },

    async onCameraSelectedForDetail(camera: Camera): Promise<void> {
      dispatch({
        type: 'DETECTION_CONFIG_LOAD_STARTED',
        editForm: {
          displayName: camera.displayName,
          host: camera.host,
          port: camera.port,
          username: camera.username ?? null,
          password: null,
          streamPath: camera.streamPath ?? null,
          vendorFamily: camera.vendorFamily ?? null,
          sourceType: camera.sourceType,
          streamProtocol: camera.streamProtocol ?? 'rtsp',
          ptzSupported: camera.ptzSupported,
        },
      })
      try {
        const config = await container.getCameraDetectionConfig.execute(camera.id)
        dispatch({
          type: 'DETECTION_CONFIG_LOADED',
          config,
          strategy: camera.privacyStrategy ?? 'none',
        })
      } catch (e) {
        toast(appErrorMessage(toAppError(e)), 'error')
        dispatch({
          type: 'DETECTION_CONFIG_LOADED',
          config: null,
          strategy: camera.privacyStrategy ?? 'none',
        })
      }
    },

    onToggleDetectionLabel(
      cameraId: string,
      value: string,
      currentLabels: string[],
      continuousRecording: boolean,
    ) {
      const nextLabels = currentLabels.includes(value)
        ? currentLabels.filter((l) => l !== value)
        : [...currentLabels, value]
      dispatch({ type: 'DETECTION_LABELS_TOGGLED', labels: nextLabels })
      container.saveCameraDetectionConfig
        .execute(cameraId, nextLabels, continuousRecording)
        .catch((e: unknown) => toast(appErrorMessage(toAppError(e)), 'error'))
    },

    onToggleDetectionContinuous(cameraId: string, currentLabels: string[], currentValue: boolean) {
      const nextValue = !currentValue
      dispatch({ type: 'DETECTION_CONTINUOUS_TOGGLED', value: nextValue })
      container.saveCameraDetectionConfig
        .execute(cameraId, currentLabels, nextValue)
        .catch((e: unknown) => toast(appErrorMessage(toAppError(e)), 'error'))
    },

    async onDiscover(): Promise<void> {
      dispatch({ type: 'DISCOVERY_STARTED' })
      try {
        const candidates = await container.discoverCameras.execute()
        dispatch({
          type: 'DISCOVERY_SUCCEEDED',
          candidates,
          selectFirst: candidates.length > 0,
          message:
            candidates.length > 0
              ? `${candidates.length} camera(s) candidate(s) detectee(s).`
              : 'Aucune camera detectee automatiquement.',
        })
      } catch (e) {
        dispatch({ type: 'DISCOVERY_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    async onCreate(
      dvripMode: boolean,
      draftConnected: boolean,
      form: CameraDraftInput,
    ): Promise<void> {
      if (!dvripMode && !draftConnected) {
        dispatch({
          type: 'CREATE_FAILED',
          message: 'Verifiez d abord le flux avant d ajouter la camera.',
        })
        return
      }
      dispatch({ type: 'CREATE_STARTED' })
      try {
        const created = await container.createCamera.execute(form)
        const verified = await container.verifyCamera.execute(created.id)
        reloadCameras()
        dispatch({ type: 'CREATE_SUCCEEDED', cameraId: created.id })
        toast(
          verified.guidance ??
            `Camera "${created.displayName}" ajoutee. Appliquez la configuration pour activer la surveillance.`,
          'success',
        )
      } catch (e) {
        dispatch({ type: 'CREATE_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    async onVerifyDraft(form: CameraDraftInput): Promise<void> {
      dispatch({ type: 'VERIFY_DRAFT_STARTED' })
      try {
        const status = await container.verifyDraftCamera.execute(form)
        dispatch({
          type: 'VERIFY_DRAFT_SUCCEEDED',
          connected: status.connected,
          guidance: status.guidance,
          message: status.connected
            ? (status.guidance ?? 'Flux valide. Vous pouvez maintenant ajouter cette camera.')
            : (status.guidance ?? 'Le flux n a pas pu etre valide.'),
        })
      } catch (e) {
        dispatch({ type: 'VERIFY_DRAFT_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    async onVerify(cameraId: string): Promise<void> {
      dispatch({ type: 'VERIFY_STARTED' })
      try {
        const status = await container.verifyCamera.execute(cameraId)
        reloadCameras()
        dispatch({ type: 'VERIFY_SUCCEEDED', message: status.guidance ?? 'Verification terminee.' })
      } catch (e) {
        dispatch({ type: 'VERIFY_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    async onRefreshCandidate(index: number, candidate: DiscoveredCamera): Promise<void> {
      dispatch({ type: 'REFRESH_CANDIDATE_STARTED' })
      try {
        const candidates = await container.discoverCameras.execute({
          host: candidate.host,
          port: candidate.port,
        })
        const refreshed = candidates.find((c) => c.host === candidate.host)
        if (!refreshed) {
          dispatch({
            type: 'REFRESH_CANDIDATE_NO_CHANGE',
            message: 'Aucune nouvelle information detectee pour ce candidat.',
          })
          return
        }
        dispatch({
          type: 'REFRESH_CANDIDATE_SUCCEEDED',
          index,
          candidate: refreshed,
          message: refreshed.streamPath
            ? 'Candidat rafraichi. La camera semble maintenant joignable.'
            : 'Candidat rafraichi. Les informations de detection ont ete mises a jour.',
        })
      } catch (e) {
        dispatch({ type: 'REFRESH_CANDIDATE_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    async onDelete(cameraId: string): Promise<void> {
      dispatch({ type: 'DELETE_STARTED' })
      try {
        const result = await container.deleteCamera.execute(cameraId)
        reloadCameras()
        dispatch({ type: 'DELETE_SUCCEEDED' })
        toast(result.message, 'info')
      } catch (e) {
        dispatch({ type: 'DELETE_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    async onUpdate(
      cameraId: string,
      editForm: CameraDraftInput,
      editPassword: string,
    ): Promise<void> {
      dispatch({ type: 'UPDATE_STARTED' })
      try {
        const updated = await container.updateCamera.execute(cameraId, {
          ...editForm,
          password: editPassword.trim() ? editPassword : null,
        })
        reloadCameras()
        dispatch({ type: 'UPDATE_SUCCEEDED' })
        toast(
          updated.validationState === 'draft'
            ? 'Camera mise a jour. Reverifiez le flux avant d appliquer la configuration.'
            : 'Camera mise a jour. Appliquez la configuration pour prendre en compte les modifications.',
          'success',
        )
      } catch (e) {
        dispatch({ type: 'UPDATE_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    async onApplyConfiguration(selectionKind: CameraSelection['kind']): Promise<void> {
      dispatch({ type: 'APPLY_STARTED' })
      const scope = selectionKind === 'camera' ? 'detail' : 'form'
      try {
        const result = await container.applyCameraConfiguration.execute()
        reloadCameras()
        if (!result.applied) {
          dispatch({ type: 'APPLY_NOT_APPLIED', scope, message: result.message })
          return
        }
        dispatch({ type: 'APPLY_SUCCEEDED' })
        toast(`${result.message} (${result.configPath})`, 'success')
      } catch (e) {
        dispatch({ type: 'APPLY_FAILED', scope, message: appErrorMessage(toAppError(e)) })
      }
    },

    onStrategyPendingChanged(value: string) {
      dispatch({ type: 'STRATEGY_PENDING_CHANGED', value })
    },

    async onSaveStrategy(cameraId: string, strategy: string): Promise<void> {
      dispatch({ type: 'SAVE_STRATEGY_STARTED' })
      try {
        await container.setPrivacyStrategy.execute(cameraId, strategy)
        reloadCameras()
        dispatch({ type: 'SAVE_STRATEGY_SUCCEEDED' })
      } catch (e) {
        dispatch({ type: 'SAVE_STRATEGY_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    onConfirmDeleteSet(value: boolean) {
      dispatch({ type: 'CONFIRM_DELETE_SET', value })
    },
    onConfirmScanSet(value: boolean) {
      dispatch({ type: 'CONFIRM_SCAN_SET', value })
    },
    onConfirmApplySet(value: boolean) {
      dispatch({ type: 'CONFIRM_APPLY_SET', value })
    },
  }
}

export type CamerasPresenter = ReturnType<typeof buildCamerasPresenter>
