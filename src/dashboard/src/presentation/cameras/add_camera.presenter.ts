import type { ToastTone } from '../../common/components/toast'
import { appErrorDiagnostic, appErrorMessage } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { AddCameraForm } from './add_camera.uido'
import type { DiscoveredCamera } from '../../domain/entities/discovered_camera.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import { reloadCameraList } from './camera_list_reload'
import type { AddCameraAction } from './add_camera.actions'

/** A failed call as the screen keeps it: its sentence and its diagnostic line. */
function failureOf(e: unknown): { message: string; diagnostic?: string } {
  const error = toAppError(e)
  return { message: appErrorMessage(error), diagnostic: appErrorDiagnostic(error) }
}

export interface AddCameraPresenterContext {
  container: CamerasContainer
  dispatch: (action: AddCameraAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildAddCameraPresenter({ container, dispatch, toast }: AddCameraPresenterContext) {
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
        const candidates = await container.discoverCameras.execute()
        dispatch({
          type: 'DISCOVERY_SUCCEEDED',
          candidates,
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
        const candidates = await container.discoverCameras.execute({
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

    /** Creates the camera from its access alone; returns its id so the screen opens its page, or `null` on failure (ADR-68 a). */
    async onCreate(form: AddCameraForm): Promise<string | null> {
      dispatch({ type: 'CREATE_STARTED' })
      try {
        const created = await container.createCamera.execute(form)
        reloadCameraList(container)
        dispatch({ type: 'CREATE_SUCCEEDED' })
        toast(`« ${created.displayName} » ajoutée.`, 'success')
        return created.id
      } catch (e) {
        dispatch({ type: 'CREATE_FAILED', ...failureOf(e) })
        return null
      }
    },

    onHelpVendorChosen(vendorFamily: string | null) {
      dispatch({ type: 'HELP_VENDOR_CHOSEN', vendorFamily })
    },

    onConfirmScanSet(value: boolean) {
      dispatch({ type: 'CONFIRM_SCAN_SET', value })
    },

    async onVendorAssistanceNeeded(vendorFamily: string | null): Promise<void> {
      const isLatest = nextVendorRequest()
      if (!vendorFamily) {
        dispatch({ type: 'VENDOR_ASSISTANCE_CLEARED' })
        return
      }
      dispatch({ type: 'VENDOR_ASSISTANCE_STARTED' })
      try {
        const assistance = await container.getVendorAssistance.execute({ vendorFamily })
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
