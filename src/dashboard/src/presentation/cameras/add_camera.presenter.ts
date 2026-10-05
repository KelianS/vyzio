import type { ToastTone } from '../../common/components/toast'
import { appErrorDiagnostic, appErrorMessage } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { CameraDraftInput } from '../../domain/entities/camera_draft_input.entity'
import type { AddCameraForm } from './add_camera.uido'
import type { DiscoveredCamera } from '../../domain/entities/discovered_camera.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import { refreshSurveillance } from '../surveillance/surveillance_refresh'
import { reloadCameraList } from './camera_list_reload'
import type { AddCameraAction } from './add_camera.actions'

/** A failed call as the screen keeps it: its sentence and its diagnostic line. */
function failureOf(e: unknown): { message: string; diagnostic?: string } {
  const error = toAppError(e)
  return { message: appErrorMessage(error), diagnostic: appErrorDiagnostic(error) }
}

/** The form as the camera is born: its access, and its stream over the protocol the form chose (ADR-61). */
function draftOf(form: AddCameraForm): CameraDraftInput {
  return {
    displayName: form.displayName,
    host: form.host,
    username: form.username,
    password: form.password,
    vendorFamily: form.vendorFamily,
    sourceType: form.sourceType,
    stream: { protocol: form.streamProtocol, port: form.port, path: form.streamPath },
  }
}

export interface AddCameraPresenterContext {
  container: CamerasContainer
  hubContainer: HubContainer
  dispatch: (action: AddCameraAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildAddCameraPresenter({
  container,
  hubContainer,
  dispatch,
  toast,
}: AddCameraPresenterContext) {
  // Only the latest request may answer: an earlier one would show another brand's notice.
  const nextVendorRequest = latestOnly()

  return {
    onFormChanged(patch: Partial<AddCameraForm>) {
      dispatch({ type: 'FORM_UPDATED', patch })
    },

    onSelectManualEntry() {
      dispatch({ type: 'MANUAL_ENTRY_SELECTED' })
    },

    /** Back to picking a camera, keeping the scan results. */
    onClearSelection() {
      dispatch({ type: 'SELECTION_CLEARED' })
    },

    onSelectCandidate(index: number, candidate: DiscoveredCamera) {
      dispatch({ type: 'CANDIDATE_SELECTED', index, candidate })
    },

    async onDiscover(): Promise<void> {
      dispatch({ type: 'DISCOVERY_STARTED' })
      try {
        const { ranges, candidates } = await container.discoverCameras.execute()
        dispatch({
          type: 'DISCOVERY_SUCCEEDED',
          candidates,
          ranges,
          message:
            candidates.length > 0
              ? `${candidates.length} caméra(s) trouvée(s).`
              : 'Aucune caméra trouvée sur le réseau.',
        })
      } catch (e) {
        dispatch({ type: 'DISCOVERY_FAILED', ...failureOf(e) })
      }
    },

    async onRefreshCandidate(index: number, candidate: DiscoveredCamera): Promise<void> {
      dispatch({ type: 'REFRESH_CANDIDATE_STARTED' })
      try {
        const { candidates } = await container.discoverCameras.execute({
          host: candidate.host,
          port: candidate.port,
        })
        const refreshed = candidates.find((c) => c.host === candidate.host)
        if (!refreshed) {
          dispatch({
            type: 'REFRESH_CANDIDATE_NO_CHANGE',
            message: 'Rien de nouveau : la caméra répond comme avant.',
          })
          return
        }
        dispatch({
          type: 'REFRESH_CANDIDATE_SUCCEEDED',
          index,
          candidate: refreshed,
          message: refreshed.stream
            ? 'La caméra est maintenant joignable.'
            : 'Informations mises à jour, mais la caméra n’est toujours pas joignable.',
        })
      } catch (e) {
        dispatch({ type: 'REFRESH_CANDIDATE_FAILED', ...failureOf(e) })
      }
    },

    async onVerifyDraft(form: AddCameraForm): Promise<void> {
      dispatch({ type: 'VERIFY_DRAFT_STARTED' })
      try {
        const status = await container.verifyDraftCamera.execute(draftOf(form))
        dispatch({
          type: 'VERIFY_DRAFT_SUCCEEDED',
          connected: status.connected,
          guidance: status.guidance,
          message: status.connected
            ? (status.guidance ?? 'Caméra joignable. Vous pouvez l’ajouter.')
            : (status.guidance ?? 'Caméra injoignable — vérifiez ces informations.'),
        })
      } catch (e) {
        dispatch({ type: 'VERIFY_DRAFT_FAILED', ...failureOf(e) })
      }
    },

    /** Returns the created camera's id so the screen can open it, or `null` on failure. */
    async onCreate(
      checkedOnceAdded: boolean,
      verified: boolean,
      form: AddCameraForm,
    ): Promise<string | null> {
      if (!checkedOnceAdded && !verified) {
        dispatch({
          type: 'CREATE_FAILED',
          message: 'Vérifiez la connexion avant d’ajouter la caméra.',
        })
        return null
      }
      dispatch({ type: 'CREATE_STARTED' })
      try {
        const created = await container.createCamera.execute(draftOf(form))
        // Post-create verification confirms the camera as the server saved it.
        const status = await container.verifyCamera.execute(created.id)
        reloadCameraList(container)
        refreshSurveillance(hubContainer)
        dispatch({ type: 'CREATE_SUCCEEDED' })
        toast(status.guidance ?? `« ${created.displayName} » ajoutée.`, 'success')
        return created.id
      } catch (e) {
        dispatch({ type: 'CREATE_FAILED', ...failureOf(e) })
        return null
      }
    },

    onConfirmScanSet(value: boolean) {
      dispatch({ type: 'CONFIRM_SCAN_SET', value })
    },

    async onVendorAssistanceNeeded(
      vendorFamily: string | null,
      streamPath: string | null,
      connected: boolean,
    ): Promise<void> {
      const isLatest = nextVendorRequest()
      if (!vendorFamily) {
        dispatch({ type: 'VENDOR_ASSISTANCE_CLEARED' })
        return
      }
      dispatch({ type: 'VENDOR_ASSISTANCE_STARTED' })
      try {
        const assistance = await container.getVendorAssistance.execute({
          vendorFamily,
          streamPath,
          connected,
        })
        if (isLatest()) {
          dispatch({ type: 'VENDOR_ASSISTANCE_SUCCEEDED', markdown: assistance?.markdown ?? null })
        }
      } catch (e) {
        if (isLatest()) {
          dispatch({ type: 'VENDOR_ASSISTANCE_FAILED', error: toAppError(e) })
        }
      }
    },
  }
}
