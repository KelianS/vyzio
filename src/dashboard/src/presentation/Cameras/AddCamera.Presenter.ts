import { appErrorMessage } from '../../common/errors/AppError'
import { toAppError } from '../../common/errors/toAppError'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import { useRootStore } from '../../infrastructure/store/rootStore'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { AddCameraAction } from './AddCamera.Actions'

export interface AddCameraPresenterContext {
  container: CamerasContainer
  dispatch: (action: AddCameraAction) => void
}

export interface CreatedCamera {
  id: string
  displayName: string
  guidance: string | null
}

export function buildAddCameraPresenter({ container, dispatch }: AddCameraPresenterContext) {
  function reloadCameras() {
    void useRootStore.getState().loadCameras(container.getCameras)
  }

  return {
    onFormChanged(patch: Partial<CameraDraftInput>) {
      dispatch({ type: 'FORM_UPDATED', patch })
    },

    onSelectManualEntry() {
      dispatch({ type: 'MANUAL_ENTRY_SELECTED' })
    },

    onSelectCandidate(index: number, candidate: DiscoveredCamera) {
      dispatch({ type: 'CANDIDATE_SELECTED', index, candidate })
    },

    onDvripModeToggle(enabled: boolean, candidate: DiscoveredCamera | null) {
      dispatch({
        type: 'DVRIP_MODE_TOGGLED',
        enabled,
        fallbackPort: candidate?.port ?? 554,
        fallbackStreamPath: candidate?.streamPath ?? null,
      })
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
              ? `${candidates.length} caméra(s) trouvée(s).`
              : 'Aucune caméra trouvée sur le réseau.',
        })
      } catch (e) {
        dispatch({ type: 'DISCOVERY_FAILED', message: appErrorMessage(toAppError(e)) })
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
          message: refreshed.streamPath
            ? 'La caméra est maintenant joignable.'
            : 'Informations mises à jour, mais la caméra n’est toujours pas joignable.',
        })
      } catch (e) {
        dispatch({ type: 'REFRESH_CANDIDATE_FAILED', message: appErrorMessage(toAppError(e)) })
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
            ? (status.guidance ?? 'Caméra joignable. Vous pouvez l’ajouter.')
            : (status.guidance ?? 'Caméra injoignable — vérifiez ces informations.'),
        })
      } catch (e) {
        dispatch({ type: 'VERIFY_DRAFT_FAILED', message: appErrorMessage(toAppError(e)) })
      }
    },

    /** Rend la camera creee pour que l'ecran puisse y conduire, ou `null` en cas d'echec. */
    async onCreate(
      dvripMode: boolean,
      verified: boolean,
      form: CameraDraftInput,
    ): Promise<CreatedCamera | null> {
      if (!dvripMode && !verified) {
        dispatch({
          type: 'CREATE_FAILED',
          message: 'Vérifiez la connexion avant d’ajouter la caméra.',
        })
        return null
      }
      dispatch({ type: 'CREATE_STARTED' })
      try {
        const created = await container.createCamera.execute(form)
        // La verification post-creation confirme la camera telle que le serveur
        // l'a enregistree, et rapporte ce qu'il reste eventuellement a faire.
        const status = await container.verifyCamera.execute(created.id)
        reloadCameras()
        dispatch({ type: 'CREATE_SUCCEEDED' })
        return { id: created.id, displayName: created.displayName, guidance: status.guidance }
      } catch (e) {
        dispatch({ type: 'CREATE_FAILED', message: appErrorMessage(toAppError(e)) })
        return null
      }
    },

    onConfirmScanSet(value: boolean) {
      dispatch({ type: 'CONFIRM_SCAN_SET', value })
    },
  }
}

export type AddCameraPresenter = ReturnType<typeof buildAddCameraPresenter>
