import type { ToastTone } from '../../common/components/Toast'
import { appErrorMessage } from '../../common/errors/AppError'
import { toAppError } from '../../common/errors/toAppError'
import type { DetectionHistoryQuery } from '../../domain/entities/DetectionHistory'
import type { Profile } from '../../domain/entities/Profile'
import type { DetectionHistoryContainer } from '../../infrastructure/providers/detectionHistory.container'
import type { DetectionHistoryAction } from './DetectionHistory.Actions'
import type { DetectionMedia } from './DetectionHistory.Uido'

export interface DetectionHistoryPresenterContext {
  container: DetectionHistoryContainer
  dispatch: (action: DetectionHistoryAction) => void
  toast: (message: string, tone?: ToastTone) => void
}

export function buildDetectionHistoryPresenter({
  container,
  dispatch,
  toast,
}: DetectionHistoryPresenterContext) {
  return {
    onMount() {
      container.getProfiles
        .execute()
        .then((profiles) => dispatch({ type: 'PROFILES_LOADED', profiles }))
        .catch((e: unknown) => toast(appErrorMessage(toAppError(e)), 'error'))

      container.getCameraLabels
        .execute()
        .then((labels) => dispatch({ type: 'LABELS_LOADED', labels }))
        .catch((e: unknown) => toast(appErrorMessage(toAppError(e)), 'error'))
    },

    onLoadHistory(query: DetectionHistoryQuery) {
      dispatch({ type: 'HISTORY_LOAD_STARTED' })
      container.getDetectionHistory
        .execute(query)
        .then((page) => dispatch({ type: 'HISTORY_LOAD_SUCCEEDED', page }))
        .catch((e: unknown) => dispatch({ type: 'HISTORY_LOAD_FAILED', error: toAppError(e) }))
    },

    onLoadMore(query: DetectionHistoryQuery, cursor: string) {
      dispatch({ type: 'HISTORY_MORE_STARTED' })
      container.getDetectionHistory
        .execute({ ...query, cursor })
        .then((page) => dispatch({ type: 'HISTORY_MORE_SUCCEEDED', page }))
        .catch((e: unknown) => {
          dispatch({ type: 'HISTORY_MORE_FAILED' })
          toast(appErrorMessage(toAppError(e)), 'error')
        })
    },

    onFilterCameraChange(value: string) {
      dispatch({ type: 'FILTER_CAMERA_SET', value })
    },
    onFilterLabelChange(value: string) {
      dispatch({ type: 'FILTER_LABEL_SET', value })
    },
    onFilterProfileChange(value: string) {
      dispatch({ type: 'FILTER_PROFILE_SET', value })
    },
    onFilterFromChange(value: string) {
      dispatch({ type: 'FILTER_FROM_SET', value })
    },
    onFilterToChange(value: string) {
      dispatch({ type: 'FILTER_TO_SET', value })
    },
    onResetFilters() {
      dispatch({ type: 'FILTERS_RESET' })
    },
    onMediaSet(media: DetectionMedia | null) {
      dispatch({ type: 'MEDIA_SET', media })
    },
    onFiltersToggle() {
      dispatch({ type: 'FILTERS_TOGGLED' })
    },

    async onCorrect(eventId: string, profile: Profile | null): Promise<void> {
      dispatch({ type: 'CORRECT_STARTED', eventId })
      try {
        await container.correctDetectionIdentity.execute(eventId, profile?.id ?? null)
        dispatch({
          type: 'CORRECT_SUCCEEDED',
          eventId,
          identity: profile?.name ?? null,
          profileId: profile?.id ?? null,
        })
        toast(profile ? 'Reconnaissance corrigée' : 'Identité retirée', 'success')
      } catch {
        dispatch({ type: 'CORRECT_FAILED' })
        toast("Erreur lors de la correction de l'identité.", 'error')
      }
    },
  }
}

export type DetectionHistoryPresenter = ReturnType<typeof buildDetectionHistoryPresenter>
